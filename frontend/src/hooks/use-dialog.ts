import { useState } from "react"

/**
 * Track a dialog that acts on one item, such as the chat being renamed.
 *
 * Closing keeps the item, so the dialog still shows it while it animates out.
 */
export function useDialog<T>() {
  const [state, setState] = useState<{ open: boolean; item: T | null }>({ open: false, item: null })
  return {
    open: state.open,
    item: state.item,
    show: (item: T) => setState({ open: true, item }),
    close: () => setState((current) => ({ ...current, open: false })),
  }
}
