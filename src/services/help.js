import { reactive } from 'vue';

// The help (HelpDialog, in App.vue): whether it is open, and on which
// topic. Any screen opens it with openHelp(topic); the sidebar's Help, F1 and
// Ctrl/Cmd+/ toggle it on the topic of the screen (topicForRoute).
export const helpState = reactive({ open: false, topic: null });

export function openHelp(topic = null) {
  helpState.topic = topic;
  helpState.open = true;
}

export function closeHelp() {
  helpState.open = false;
}

// The sidebar's Help, F1: close it when open, whatever it shows
export function toggleHelp(topic = null) {
  if (helpState.open) closeHelp();
  else openHelp(topic);
}

/** The topic that explains the screen of a route, null for none in particular. */
export function topicForRoute(route) {
  const path = route?.path || '';
  if (path.startsWith('/lookup')) return 'lookup';
  if (path.startsWith('/search')) return 'search';
  if (path.startsWith('/reader')) return 'reader';
  if (path.startsWith('/dictionaries')) return 'dictionaries';
  if (path.startsWith('/glossary')) return 'glossary';
  if (path.startsWith('/saved')) return 'saved';
  return null;
}
