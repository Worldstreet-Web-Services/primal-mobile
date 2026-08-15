/**
 * Shared entry timing for the payments flow. The layout owns the drawer and the
 * routes own their copy, so the two beats have to agree from one place — if the
 * copy's delay drifts below the drawer's, the text animates behind the glass
 * while it is still travelling.
 */

/** Beat the drawer starts on — the mark gets the screen to itself until here. */
export const DRAWER_DELAY = 560;

/** How long the drawer takes to settle once it starts. */
export const DRAWER_DURATION = 760;

/** Copy starts as the drawer is arriving, not after it has stopped. */
export const DRAWER_COPY_DELAY = DRAWER_DELAY + 220;
