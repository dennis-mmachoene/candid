/**
 * Reading a skills line the way a person wrote it.
 *
 * These come from one line of one real CV:
 *
 *   DevOps / Deployment: Docker, AWS (EC2, S3, Route 53, CloudFront), Linux, Git, CI/CD
 *
 * Candid split on the comma before it looked at the bracket, so it recorded
 * "aws ec2" and never plain "aws". A live tailoring then refused AWS as
 * unsupported, on a CV that lists it, for a cloud infrastructure job. It also
 * kept the category label and recorded "deployment docker" rather than
 * "docker".
 */

import { describe, expect, it } from 'vitest';

import {
  buildInventory,
  extractSkillsSectionEntries,
  inventoryHas,
} from '@/lib/domain/inventory';

const REAL_LINE =
  'DevOps / Deployment: Docker, AWS (EC2, S3, Route 53, CloudFront), Linux, Git, CI/CD';

const CV = `Skills & Tools
Technical Skills:
• Front-End: React, React Native, HTML5, CSS3, JavaScript, TypeScript
• Back-End / APIs: Node.js, C#, Java, Python, RESTful APIs, MySQL
• ${REAL_LINE}`;

describe('a skills line with a bracketed list in it', () => {
  const surfaces = extractSkillsSectionEntries([
    'Technical Skills:',
    REAL_LINE,
  ]).map((entry) => entry.surface.toLowerCase());

  it('records the term in front of the bracket', () => {
    expect(surfaces).toContain('aws');
  });

  it('records what is inside the bracket as well', () => {
    expect(surfaces).toContain('ec2');
    expect(surfaces).toContain('s3');
    expect(surfaces).toContain('route 53');
    expect(surfaces).toContain('cloudfront');
  });

  it('never produces the run-together term the split used to make', () => {
    expect(surfaces).not.toContain('aws (ec2');
    expect(surfaces).not.toContain('cloudfront)');
  });

  /** "Deployment:" labels the group. It is not something anyone can do. */
  it('drops the category label in front of the colon', () => {
    expect(surfaces).toContain('docker');
    expect(surfaces).not.toContain('deployment: docker');
  });
});

describe('the inventory built from a real skills section', () => {
  const inventory = buildInventory(CV);

  /**
   * The claim that was refused. AWS is on the page, in the applicant's own
   * words, in the section headed Technical Skills.
   */
  it('supports a claim to AWS', () => {
    expect(inventoryHas(inventory, 'AWS')).toBe(true);
  });

  it('supports a claim to the specific services too', () => {
    expect(inventoryHas(inventory, 'S3')).toBe(true);
    expect(inventoryHas(inventory, 'CloudFront')).toBe(true);
  });

  it('still supports the plain entries beside it', () => {
    for (const skill of ['Docker', 'Linux', 'Git', 'React', 'TypeScript', 'Python']) {
      expect(inventoryHas(inventory, skill)).toBe(true);
    }
  });

  /**
   * The point of the inventory is still to refuse what is not there. Widening
   * how a line is read must not widen what counts as evidence.
   */
  it('still refuses what the CV does not mention', () => {
    for (const skill of ['Kubernetes', 'Google Cloud Platform', 'ArgoCD', 'Terraform']) {
      expect(inventoryHas(inventory, skill)).toBe(false);
    }
  });
});
