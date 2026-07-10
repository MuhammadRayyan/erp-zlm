import { db } from './db'
import { Decimal, money, add, isBalanced } from './decimal'

// Post a journal entry with double-entry validation
// This is the SINGLE entry point for all financial transactions
export interface JournalLineInput {
  accountId: string
  debit: number | string
  credit: number | string
  description?: string
  partyId?: string
}

export interface PostJournalParams {
  businessId: string
  userId: string
  date: Date
  reference?: string
  description?: string
  sourceType?: string // SALES_INVOICE, PURCHASE_BILL, PAYMENT, MANUAL
  sourceId?: string
  lines: JournalLineInput[]
}

export async function postJournalEntry(params: PostJournalParams): Promise<string> {
  const { businessId, userId, date, reference, description, sourceType, sourceId, lines } = params

  // Validate: at least 2 lines
  if (lines.length < 2) {
    throw new Error('Journal entry must have at least 2 lines')
  }

  // Validate: debits = credits
  if (!isBalanced(lines)) {
    const totalDebit = lines.reduce((s, l) => s.plus(money(l.debit)), money(0))
    const totalCredit = lines.reduce((s, l) => s.plus(money(l.credit)), money(0))
    throw new Error(`Journal entry not balanced. Debits: ${totalDebit}, Credits: ${totalCredit}`)
  }

  // Generate sequential journal number
  const count = await db.journalEntry.count({ where: { businessId } })
  const number = `JE-${String(count + 1).padStart(6, '0')}`

  // Create the journal entry with lines
  const entry = await db.journalEntry.create({
    data: {
      businessId,
      number,
      date,
      reference,
      description,
      sourceType,
      sourceId,
      isPosted: true,
      postedAt: new Date(),
      createdById: userId,
      lines: {
        create: lines.map(l => ({
          accountId: l.accountId,
          debit: new Decimal(l.debit || 0),
          credit: new Decimal(l.credit || 0),
          description: l.description,
          partyId: l.partyId,
        })),
      },
    },
  })

  return entry.id
}

// Reverse a journal entry (for credit notes, voids)
export async function reverseJournalEntry(entryId: string, userId: string, reason: string): Promise<string> {
  const original = await db.journalEntry.findUnique({
    where: { id: entryId },
    include: { lines: true },
  })
  if (!original) throw new Error('Journal entry not found')
  if (original.isReversed) throw new Error('Journal entry already reversed')

  // Create reversal entry with swapped debits/credits
  const count = await db.journalEntry.count({ where: { businessId: original.businessId } })
  const number = `JE-${String(count + 1).padStart(6, '0')}`

  const reversal = await db.journalEntry.create({
    data: {
      businessId: original.businessId,
      number,
      date: new Date(),
      reference: `Reversal of ${original.number}`,
      description: reason,
      sourceType: 'REVERSAL',
      sourceId: original.id,
      isPosted: true,
      postedAt: new Date(),
      createdById: userId,
      lines: {
        create: original.lines.map(l => ({
          accountId: l.accountId,
          debit: l.credit, // swap
          credit: l.debit, // swap
          description: `Reversal: ${l.description || ''}`,
          partyId: l.partyId,
        })),
      },
    },
  })

  // Mark original as reversed
  await db.journalEntry.update({
    where: { id: entryId },
    data: { isReversed: true, reversedById: reversal.id },
  })

  return reversal.id
}

// Get account balance for a date range
export async function getAccountBalance(
  accountId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{ debit: Decimal; credit: Decimal; balance: Decimal }> {
  const where: {
    accountId: string
    journalEntry?: { date?: { gte?: Date; lte?: Date }; isPosted: boolean }
  } = {
    accountId,
    journalEntry: { isPosted: true },
  }

  if (startDate || endDate) {
    where.journalEntry!.date = {}
    if (startDate) where.journalEntry!.date!.gte = startDate
    if (endDate) where.journalEntry!.date!.lte = endDate
  }

  const lines = await db.journalLine.findMany({
    where,
    select: { debit: true, credit: true },
  })

  const debit = lines.reduce((s, l) => s.plus(money(l.debit)), money(0))
  const credit = lines.reduce((s, l) => s.plus(money(l.credit)), money(0))
  const balance = debit.minus(credit)

  return { debit, credit, balance }
}

// Get trial balance
export async function getTrialBalance(businessId: string, asOfDate: Date) {
  const accounts = await db.account.findMany({
    where: { businessId, isActive: true },
    include: {
      journalLines: {
        where: {
          journalEntry: { isPosted: true, date: { lte: asOfDate } },
        },
        select: { debit: true, credit: true },
      },
    },
  })

  return accounts.map(acc => {
    const debit = acc.journalLines.reduce((s, l) => s.plus(money(l.debit)), money(0))
    const credit = acc.journalLines.reduce((s, l) => s.plus(money(l.credit)), money(0))
    const balance = debit.minus(credit)
    // Assets & Expenses have debit balance; Liabilities, Equity, Income have credit balance
    const isDebitType = acc.type === 'ASSET' || acc.type === 'EXPENSE'
    return {
      id: acc.id,
      code: acc.code,
      name: acc.name,
      type: acc.type,
      subtype: acc.subtype,
      debit: isDebitType ? balance.abs() : money(0),
      credit: !isDebitType ? balance.abs() : money(0),
      rawBalance: balance,
    }
  })
}
