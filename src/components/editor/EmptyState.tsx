interface EmptyStateProps {
  onRecord: () => void;
  onCreateNew: () => void;
}

export function EmptyState(props: EmptyStateProps) {
  return (
    <div class="flex-1 flex flex-col items-center justify-center text-neutral-500 p-8">
      {/* Music icon */}
      <svg class="w-20 h-20 mb-6 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1"
          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
        />
      </svg>

      <p class="text-lg mb-2 text-neutral-400">No mix selected</p>
      <p class="text-sm mb-6 text-neutral-600 text-center max-w-xs">
        Select a mix from the sidebar or start recording
      </p>

      <div class="flex gap-3">
        <button
          onClick={props.onRecord}
          class="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors flex items-center gap-2 font-medium"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8" />
          </svg>
          Record
        </button>
        <button
          onClick={props.onCreateNew}
          class="px-5 py-2.5 bg-neutral-800 text-neutral-300 rounded-lg hover:bg-neutral-700 transition-colors font-medium"
        >
          New Mix
        </button>
      </div>
    </div>
  );
}
