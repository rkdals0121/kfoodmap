// "Show these stops on the map" (Discover) asks the map for a journey's
// places and nothing else. Asked here, taken once by App: kept in the
// history entry instead, it was read again every time the address was
// rewritten, and wiped each letter typed into the search.
let pending = false;
export const askFreshList = () => { pending = true; };
export const takeFreshList = () => { const was = pending; pending = false; return was; };
