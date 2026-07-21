export default function Loading() {
  return (
    <div id="loading-indicator" aria-live="polite" aria-busy="true">
      <div className="lds-hourglass" aria-hidden="true"></div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
