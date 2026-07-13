'use client'
import { Component, ReactNode } from 'react'

export class ModuleErrorBoundary extends Component<
  { children: ReactNode; moduleName: string },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error: Error) { console.error(`[${this.props.moduleName}]`, error) }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center text-muted-foreground">
          <p>Something went wrong in {this.props.moduleName}.</p>
          <button className="mt-2 rounded border px-4 py-1 text-sm" onClick={() => this.setState({ hasError: false })}>Try again</button>
        </div>
      )
    }
    return this.props.children
  }
}
