/**
 * Learning resources for the gaps.
 *
 * The honest half of this product is telling someone what they are missing.
 * That is only useful if it comes with somewhere to go, otherwise it is a list
 * of reasons they will not get the job.
 *
 * Every link here is a real, checked, first-party or well-established source.
 * Nothing is generated, and nothing is affiliate-linked. A tool built on not
 * fabricating things should not fabricate a URL, and a made-up course link is
 * exactly the kind of small dishonesty that costs a user an afternoon.
 *
 * Free options are listed first throughout. The users this is built for are
 * looking for work.
 */

import { canonicalise } from './inventory';

export interface LearningResource {
  title: string;
  url: string;
  /** Shown as a badge, so someone can see the cost before they click. */
  cost: 'free' | 'free to audit' | 'paid';
  provider: string;
}

/**
 * Canonical skill key -> resources. Keys match the output of `canonicalise()`,
 * so an advert asking for "K8s" finds the Kubernetes entry.
 */
const RESOURCES: Readonly<Record<string, readonly LearningResource[]>> = {
  kubernetes: [
    {
      title: 'Kubernetes Basics tutorial',
      url: 'https://kubernetes.io/docs/tutorials/kubernetes-basics/',
      cost: 'free',
      provider: 'Kubernetes (official)',
    },
  ],
  docker: [
    {
      title: 'Docker: Get started',
      url: 'https://docs.docker.com/get-started/',
      cost: 'free',
      provider: 'Docker (official)',
    },
  ],
  javascript: [
    {
      title: 'JavaScript Algorithms and Data Structures',
      url: 'https://www.freecodecamp.org/learn',
      cost: 'free',
      provider: 'freeCodeCamp',
    },
    {
      title: 'JavaScript guide',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide',
      cost: 'free',
      provider: 'MDN',
    },
  ],
  typescript: [
    {
      title: 'The TypeScript Handbook',
      url: 'https://www.typescriptlang.org/docs/handbook/intro.html',
      cost: 'free',
      provider: 'TypeScript (official)',
    },
  ],
  python: [
    {
      title: 'The Python Tutorial',
      url: 'https://docs.python.org/3/tutorial/',
      cost: 'free',
      provider: 'Python (official)',
    },
  ],
  postgresql: [
    {
      title: 'PostgreSQL Tutorial',
      url: 'https://www.postgresql.org/docs/current/tutorial.html',
      cost: 'free',
      provider: 'PostgreSQL (official)',
    },
  ],
  sql: [
    {
      title: 'Relational Databases and SQL',
      url: 'https://www.freecodecamp.org/learn/relational-database/',
      cost: 'free',
      provider: 'freeCodeCamp',
    },
  ],
  react: [
    {
      title: 'Learn React',
      url: 'https://react.dev/learn',
      cost: 'free',
      provider: 'React (official)',
    },
  ],
  'version control': [
    {
      title: 'Git documentation and book',
      url: 'https://git-scm.com/doc',
      cost: 'free',
      provider: 'Git (official)',
    },
  ],
  'amazon web services': [
    {
      title: 'AWS Skill Builder',
      url: 'https://skillbuilder.aws/',
      cost: 'free',
      provider: 'AWS (official)',
    },
  ],
  'microsoft azure': [
    {
      title: 'Azure learning paths',
      url: 'https://learn.microsoft.com/en-us/training/azure/',
      cost: 'free',
      provider: 'Microsoft Learn',
    },
  ],
  'google cloud platform': [
    {
      title: 'Google Cloud Skills Boost',
      url: 'https://www.cloudskillsboost.google/',
      cost: 'free to audit',
      provider: 'Google Cloud (official)',
    },
  ],
  linux: [
    {
      title: 'Linux Journey',
      url: 'https://linuxjourney.com/',
      cost: 'free',
      provider: 'Linux Journey',
    },
  ],
  'microsoft excel': [
    {
      title: 'Excel help and learning',
      url: 'https://support.microsoft.com/en-us/excel',
      cost: 'free',
      provider: 'Microsoft (official)',
    },
  ],
  'data analysis': [
    {
      title: 'Data Analysis with Python',
      url: 'https://www.freecodecamp.org/learn/data-analysis-with-python/',
      cost: 'free',
      provider: 'freeCodeCamp',
    },
  ],
  'agile methodologies': [
    {
      title: 'The Scrum Guide',
      url: 'https://scrumguides.org/',
      cost: 'free',
      provider: 'Scrum.org',
    },
  ],
  'project management': [
    {
      title: 'Google Project Management Certificate',
      url: 'https://www.coursera.org/professional-certificates/google-project-management',
      cost: 'free to audit',
      provider: 'Coursera',
    },
  ],
  'machine learning': [
    {
      title: 'Machine Learning Specialisation',
      url: 'https://www.coursera.org/specializations/machine-learning-introduction',
      cost: 'free to audit',
      provider: 'Coursera',
    },
  ],
  'rest apis': [
    {
      title: 'HTTP and REST on MDN',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP',
      cost: 'free',
      provider: 'MDN',
    },
  ],
  'ci/cd': [
    {
      title: 'GitHub Actions documentation',
      url: 'https://docs.github.com/en/actions',
      cost: 'free',
      provider: 'GitHub (official)',
    },
  ],
};

/**
 * Where to send someone when we have nothing curated.
 *
 * A search link rather than an invented course page. It is less satisfying and
 * it is honest, which is the trade this whole product makes.
 */
function fallback(skill: string): readonly LearningResource[] {
  const query = encodeURIComponent(skill);
  return [
    {
      title: `Courses on "${skill}"`,
      url: `https://www.coursera.org/search?query=${query}`,
      cost: 'free to audit',
      provider: 'Coursera',
    },
    {
      title: `Free tutorials on "${skill}"`,
      url: `https://www.youtube.com/results?search_query=${query}+tutorial`,
      cost: 'free',
      provider: 'YouTube',
    },
  ];
}

export function resourcesForGap(skill: string): readonly LearningResource[] {
  return RESOURCES[canonicalise(skill)] ?? fallback(skill);
}

/** True when we have a curated entry rather than a search fallback. */
export function hasCuratedResources(skill: string): boolean {
  return canonicalise(skill) in RESOURCES;
}
