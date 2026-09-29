/**
 * Skills refused on a CV that supports them.
 *
 * Running the product against a real CV and a real advert produced five
 * refusals that were simply wrong:
 *
 *   Monitoring           "Implemented Zabbix for monitoring and Slurm for
 *                         workload scheduling."
 *   Logging              "Introduced structured logging and Prometheus metrics."
 *   Code review          "...managing API development and code review processes."
 *   Backend development  "Started as Backend Developer Intern, promoted to
 *                         Backend Team Lead."
 *   Agile methodology    "Agile / Scrum coordination"
 *
 * Each was reported to the applicant as "your CV does not mention this". Four of
 * them were vocabulary gaps: the inventory knew two hundred product names and
 * almost none of the words people use for what they did with them. The fifth was
 * a spelling mismatch. The alias map held "agile methodologies"; the model wrote
 * "agile methodology"; nothing in between looked at the last letter.
 *
 * A wrong refusal is not a safe failure. It deletes true work from somebody's
 * CV and tells them their own document does not say what it says.
 */

import { describe, expect, it } from 'vitest';

import { buildInventory, canonicalise, inventoryHas } from '@/lib/domain/inventory';

const CV = `Profile
Full-stack developer building web applications.

Work Experience
Software Developer & Researcher
Council for Scientific and Industrial Research (CSIR), Pretoria | April 2025 - Present
• Introduced structured logging and Prometheus metrics across eleven services.
• Implemented Zabbix for monitoring and Slurm for workload scheduling.
• Optimized a 15-minute report process to seconds using materialized views.

Backend Developer | Full Stack Developer | Scrum Master
Informatic and Community Engagement Projects (ICEP) | June 2024 - June 2025
• Started as Backend Developer Intern, promoted to Backend Team Lead, managing API development and code review processes.
• Deployed containerized applications using Docker and managed hosting on AWS EC2.

Skills & Tools
Technical Skills:
• Front-End: React, React Native, HTML5, CSS3, JavaScript, TypeScript
• Back-End / APIs: Node.js, C#, Java, Python, RESTful APIs, MySQL
• DevOps / Deployment: Docker, AWS (EC2, S3, Route 53, CloudFront), Linux, Git, CI/CD

Soft Skills:
• Problem-solving & analytical thinking
• Agile / Scrum coordination`;

const inventory = buildInventory(CV);

describe('the five claims that were wrongly refused', () => {
  it('supports a claim to monitoring', () => {
    expect(inventoryHas(inventory, 'Monitoring')).toBe(true);
  });

  it('supports a claim to logging', () => {
    expect(inventoryHas(inventory, 'Logging')).toBe(true);
  });

  it('supports a claim to code review', () => {
    expect(inventoryHas(inventory, 'Code review')).toBe(true);
  });

  it('supports a claim to backend development', () => {
    expect(inventoryHas(inventory, 'Backend development')).toBe(true);
  });

  /** The singular. This is the one that was a spelling mismatch, not a gap. */
  it('supports a claim to agile methodology', () => {
    expect(inventoryHas(inventory, 'Agile methodology')).toBe(true);
  });
});

describe('number no longer decides the verdict', () => {
  it('reads the singular and the plural as one skill', () => {
    expect(canonicalise('Agile methodology')).toBe(canonicalise('agile methodologies'));
    expect(canonicalise('Code reviews')).toBe(canonicalise('code review'));
    expect(canonicalise('microservice')).toBe(canonicalise('microservices'));
  });

  /**
   * Words that end in S without being plural. Folding these would invent a
   * term, and the two spellings of one skill would stop meeting.
   */
  it('leaves alone the words that only look plural', () => {
    expect(canonicalise('CSS')).toBe('css');
    expect(canonicalise('iOS')).toBe('ios');
    expect(canonicalise('analysis')).toBe('analysis');
    expect(canonicalise('DevOps')).toBe(canonicalise('devops'));
  });

  it('still resolves the aliases it always did', () => {
    expect(canonicalise('AWS')).toBe('amazon web services');
    expect(canonicalise('k8s')).toBe('kubernetes');
    expect(canonicalise('JS')).toBe('javascript');
  });
});

describe('what the CV still does not support', () => {
  /**
   * The point of widening the vocabulary is to stop refusing true claims. It is
   * not to start accepting false ones, so the refusals that were right stay
   * right.
   */
  it('refuses tools the CV never names', () => {
    for (const skill of ['Kubernetes', 'Terraform', 'GraphQL', 'Kotlin', 'Azure']) {
      expect(inventoryHas(inventory, skill)).toBe(false);
    }
  });

  it('refuses competencies the CV never claims', () => {
    for (const skill of [
      'Penetration testing',
      'Machine learning',
      'Financial reporting',
      'Recruitment',
      'Nursing',
    ]) {
      expect(inventoryHas(inventory, skill)).toBe(false);
    }
  });

  /**
   * "Front-End:" labels a group of skills. The label is not itself a claim
   * about the applicant, and a word that only ever appears as a heading must
   * not become one.
   */
  it('does not turn a bare word into a skill it never saw', () => {
    expect(inventoryHas(inventory, 'Welding')).toBe(false);
    expect(inventoryHas(inventory, 'Teaching')).toBe(false);
  });
});

describe('the competencies the CV does claim, in its own words', () => {
  it('records what the applicant said they did', () => {
    for (const skill of [
      'Workload scheduling',
      'Deployment',
      'Docker',
      'AWS',
      'React',
      'TypeScript',
    ]) {
      expect(inventoryHas(inventory, skill)).toBe(true);
    }
  });
});
