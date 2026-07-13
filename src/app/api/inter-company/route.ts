import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  ensureBusinessId,
  getSession,
  hasPermission,
  AuthError,
} from '@/lib/auth'
import { postJournalEntry } from '@/lib/journal-service'
import { money, toNumber } from '@/lib/decimal'

// GET /api/inter-company — list businesses the current user can transfer
// funds between (within their tenant memberships).
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // Find all tenant memberships for the current user
  const memberships = await db.userTenant.findMany({
    where: { userId: session.userId, isActive: true },
    include: {
      tenant: { select: { id: true, name: true, slug: true } },
    },
  })
  const tenantIds = memberships.map(m => m.tenantId)
  if (tenantIds.length === 0) return NextResponse.json({ items: [] })

  const businesses = await db.business.findMany({
    where: { tenantId: { in: tenantIds } },
    select: {
      id: true,
      name: true,
      tenantId: true,
      baseCurrency: true,
      tenant: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({
    items: businesses.map(b => ({
      id: b.id,
      name: b.name,
      baseCurrency: b.baseCurrency,
      tenantId: b.tenantId,
      tenantName: b.tenant.name,
      tenantSlug: b.tenant.slug,
    })),
  })
}

// POST /api/inter-company — create an inter-company transfer
// Body: {
//   fromBusinessId, toBusinessId,
//   amount, currency?, exchangeRate?,
//   date, description?, reference?,
//   fromAccountId (cash/bank), toAccountId (cash/bank),
//   interCompanyAccountId? (auto-detected if omitted)
// }
// This creates a balanced pair of journal entries — one in each business —
// linked via reference so they can be reconciled later.
export async function POST(req: NextRequest) {
  // ensureBusinessId establishes the user's session/business context.
  // The transfer may not involve the "current" business, but auth context
  // is required before we touch any data.
  let _currentBusinessId: string
  try {
    _currentBusinessId = await ensureBusinessId()
  } catch (e) {
    if (e instanceof AuthError || (e as Error).message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
  void _currentBusinessId

  if (!(await hasPermission('tenant.accounting'))) {
    return NextResponse.json(
      { error: 'Insufficient permissions: accounting role required' },
      { status: 403 }
    )
  }

  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const userId = session.userId

  const body = await req.json()
  const {
    fromBusinessId,
    toBusinessId,
    amount,
    currency,
    exchangeRate,
    date,
    description,
    reference,
    fromAccountId,
    toAccountId,
    interCompanyAccountId,
  } = body || {}

  if (!fromBusinessId || !toBusinessId || !amount || !date || !fromAccountId || !toAccountId) {
    return NextResponse.json(
      {
        error:
          'fromBusinessId, toBusinessId, amount, date, fromAccountId, and toAccountId are required',
      },
      { status: 400 }
    )
  }
  if (fromBusinessId === toBusinessId) {
    return NextResponse.json(
      { error: 'Source and destination businesses must differ' },
      { status: 400 }
    )
  }
  const amt = money(amount)
  if (amt.lte(0)) {
    return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 })
  }

  // Verify the user has access to both businesses (via tenant membership)
  const [fromBiz, toBiz] = await Promise.all([
    db.business.findUnique({
      where: { id: fromBusinessId },
      include: { tenant: { select: { id: true, name: true } } },
    }),
    db.business.findUnique({
      where: { id: toBusinessId },
      include: { tenant: { select: { id: true, name: true } } },
    }),
  ])
  if (!fromBiz) return NextResponse.json({ error: 'Source business not found' }, { status: 404 })
  if (!toBiz) return NextResponse.json({ error: 'Destination business not found' }, { status: 404 })

  const userTenantIds = (
    await db.userTenant.findMany({
      where: { userId, isActive: true },
      select: { tenantId: true },
    })
  ).map(m => m.tenantId)
  if (!userTenantIds.includes(fromBiz.tenantId) && session.role !== 'PLATFORM_ADMIN') {
    return NextResponse.json({ error: 'No access to source business' }, { status: 403 })
  }
  if (!userTenantIds.includes(toBiz.tenantId) && session.role !== 'PLATFORM_ADMIN') {
    return NextResponse.json({ error: 'No access to destination business' }, { status: 403 })
  }

  // Verify accounts exist and belong to their respective businesses
  const [fromAccount, toAccount] = await Promise.all([
    db.account.findFirst({ where: { id: fromAccountId, businessId: fromBusinessId } }),
    db.account.findFirst({ where: { id: toAccountId, businessId: toBusinessId } }),
  ])
  if (!fromAccount) {
    return NextResponse.json(
      { error: 'Source account not found in source business' },
      { status: 404 }
    )
  }
  if (!toAccount) {
    return NextResponse.json(
      { error: 'Destination account not found in destination business' },
      { status: 404 }
    )
  }

  const txDate = new Date(date)
  if (isNaN(txDate.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  }

  // Shared reference number (used as a cross-business link)
  const transferRef =
    reference || `IC-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
  const transferDesc =
    description || `Inter-company transfer: ${fromBiz.name} → ${toBiz.name}`

  // Resolve inter-company "Due To" (liability) account in the source business
  // and "Due From" (asset) account in the destination business.
  // Auto-detect by subtype, then by name pattern.
  const resolveDueToAccount = async () => {
    if (interCompanyAccountId) {
      const inSrc = await db.account.findFirst({
        where: { id: interCompanyAccountId, businessId: fromBusinessId },
      })
      if (inSrc) return inSrc
    }
    return (
      (await db.account.findFirst({
        where: { businessId: fromBusinessId, subtype: 'INTERCOMPANY' },
      })) ||
      (await db.account.findFirst({
        where: {
          businessId: fromBusinessId,
          type: 'LIABILITY',
          name: { contains: 'Inter-Company' },
        },
      }))
    )
  }

  const resolveDueFromAccount = async () => {
    if (interCompanyAccountId) {
      const inDest = await db.account.findFirst({
        where: { id: interCompanyAccountId, businessId: toBusinessId },
      })
      if (inDest) return inDest
    }
    return (
      (await db.account.findFirst({
        where: { businessId: toBusinessId, subtype: 'INTERCOMPANY' },
      })) ||
      (await db.account.findFirst({
        where: {
          businessId: toBusinessId,
          type: 'ASSET',
          name: { contains: 'Inter-Company' },
        },
      }))
    )
  }

  const [fromDueToAccount, toDueFromAccount] = await Promise.all([
    resolveDueToAccount(),
    resolveDueFromAccount(),
  ])

  if (!fromDueToAccount || !toDueFromAccount) {
    return NextResponse.json(
      {
        error:
          'Inter-company account not found. Create an account with subtype "INTERCOMPANY" or a name containing "Inter-Company" in both businesses.',
      },
      { status: 400 }
    )
  }

  // Run both journal postings inside a transaction so we don't end up
  // with one side posted and the other failed.
  const result = await db.$transaction(async () => {
    // Source business: credit cash, debit "Due To <dest>"
    const fromEntryId = await postJournalEntry({
      businessId: fromBusinessId,
      userId,
      date: txDate,
      reference: transferRef,
      description: `${transferDesc} (outgoing)`,
      sourceType: 'INTER_COMPANY',
      lines: [
        {
          accountId: fromDueToAccount.id,
          debit: toNumber(amt),
          credit: 0,
          description: `Due to ${toBiz.name}`,
        },
        {
          accountId: fromAccount.id,
          debit: 0,
          credit: toNumber(amt),
          description: `Cash transfer to ${toBiz.name}`,
        },
      ],
    })

    // Destination business: debit cash, credit "Due From <source>"
    const toEntryId = await postJournalEntry({
      businessId: toBusinessId,
      userId,
      date: txDate,
      reference: transferRef,
      description: `${transferDesc} (incoming)`,
      sourceType: 'INTER_COMPANY',
      lines: [
        {
          accountId: toAccount.id,
          debit: toNumber(amt),
          credit: 0,
          description: `Cash received from ${fromBiz.name}`,
        },
        {
          accountId: toDueFromAccount.id,
          debit: 0,
          credit: toNumber(amt),
          description: `Due from ${fromBiz.name}`,
        },
      ],
    })

    return { fromEntryId, toEntryId }
  })

  // Audit logs (best-effort, both businesses)
  await Promise.all([
    db.auditLog
      .create({
        data: {
          businessId: fromBusinessId,
          tenantId: fromBiz.tenantId,
          userId,
          action: 'INTER_COMPANY_OUT',
          entityType: 'JOURNAL_ENTRY',
          entityId: result.fromEntryId,
          description: `Inter-company transfer out: ${toNumber(amt)} ${currency || fromBiz.baseCurrency} to ${toBiz.name} (ref ${transferRef})`,
        },
      })
      .catch(() => {}),
    db.auditLog
      .create({
        data: {
          businessId: toBusinessId,
          tenantId: toBiz.tenantId,
          userId,
          action: 'INTER_COMPANY_IN',
          entityType: 'JOURNAL_ENTRY',
          entityId: result.toEntryId,
          description: `Inter-company transfer in: ${toNumber(amt)} ${currency || toBiz.baseCurrency} from ${fromBiz.name} (ref ${transferRef})`,
        },
      })
      .catch(() => {}),
  ])

  return NextResponse.json({
    ok: true,
    reference: transferRef,
    amount: toNumber(amt),
    currency: currency || fromBiz.baseCurrency,
    exchangeRate: exchangeRate || 1,
    fromEntryId: result.fromEntryId,
    toEntryId: result.toEntryId,
    fromBusiness: { id: fromBiz.id, name: fromBiz.name, tenantId: fromBiz.tenantId },
    toBusiness: { id: toBiz.id, name: toBiz.name, tenantId: toBiz.tenantId },
  })
}
