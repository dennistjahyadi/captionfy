/**
 * How the interface says a count and how it names a project.
 *
 * Both exist because they are said in more than one place and have to match.
 * A project with no name of its own is identified by the only three things the
 * user can see about it, and a destructive dialog has to use all three: two
 * clips of the same length with the same number of words are not rare, and one
 * of them is somebody's afternoon.
 */
import type { Project } from '../domain';
import { formatClock } from './time';

/** `1 word`, `173 words`. */
export function plural(count: number, singular: string, many = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : many}`;
}

/** `0:53 · 173 words · 13 Sep 12:18`. */
export function describeProject(project: Project): string {
  return [
    formatClock(project.durationMs),
    plural(project.words.length, 'word'),
    madeAt(project.createdAt),
  ].join(' · ');
}

/**
 * When the project was started, in the phone's own locale and time zone.
 *
 * The date is what separates two takes of the same script, so it is the part
 * that has to be there. The year is not: a project list is days old, not years.
 */
function madeAt(createdAt: string): string {
  const when = new Date(createdAt);
  if (Number.isNaN(when.getTime())) return 'date unknown';

  return when.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
