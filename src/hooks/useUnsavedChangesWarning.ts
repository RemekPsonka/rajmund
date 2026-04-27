import { useEffect } from "react";

const DEFAULT_MESSAGE =
  "Masz niezakończoną partię. Czy na pewno chcesz wyjść? Postęp zostanie utracony, zlecenie zostanie w bazie ze statusem Open.";

/**
 * Ostrzega operatora, gdy próbuje opuścić terminal z niezakończoną pracą.
 * - beforeunload: refresh / zamknięcie tabu / nawigacja poza app
 * - capture-phase click na <a>: nawigacja wewnętrzna (sidebar, linki w aplikacji)
 *
 * NIE blokuje wyjścia — tylko pyta. Działa z klasycznym BrowserRouter
 * (useBlocker z react-router 6.4+ wymaga data routera, którego tu nie ma).
 */
export function useUnsavedChangesWarning(isDirty: boolean, message: string = DEFAULT_MESSAGE) {
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // przeglądarki ignorują custom text, ale wymagają ustawienia returnValue
      e.returnValue = message;
      return message;
    };

    const handleClickCapture = (e: MouseEvent) => {
      // tylko lewy przycisk, bez modyfikatorów (otwieranie w nowej karcie itp.)
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      // nowa karta / iframe / download — niech browser sam się tym zajmie (beforeunload zadziała)
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      // linki zewnętrzne: pokryte przez beforeunload
      if (url.host !== window.location.host) return;

      // ten sam path: nie pytamy
      if (url.pathname === window.location.pathname) return;

      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleClickCapture, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleClickCapture, true);
    };
  }, [isDirty, message]);
}
