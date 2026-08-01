'use client';

import { useState } from 'react';
import { Check, Download, FileText } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { TEMPLATES } from '@/lib/domain/resume-document';

/**
 * Template picker and download.
 *
 * Templates change typography and spacing. They cannot change what the document
 * contains — that is a property of the type, not a promise made here — so this
 * component only ever passes a template id along.
 *
 * Downloads are plain anchors rather than a fetch and a blob. The browser
 * handles the file, the Content-Disposition header names it, and nothing about
 * the document passes through client-side JavaScript on the way.
 */
export function ExportPanel({
  tailoringId,
  defaultTemplate,
  disabled,
}: {
  tailoringId: string;
  defaultTemplate: string;
  disabled?: boolean;
}) {
  const [templateId, setTemplateId] = useState(defaultTemplate);

  const href = (format: 'pdf' | 'docx') =>
    `/api/export/${tailoringId}?format=${format}&template=${templateId}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <span className="gradient-brand shadow-soft grid size-9 place-items-center rounded-lg">
            <Download className="size-4 text-white" aria-hidden />
          </span>
          <CardTitle asChild className="text-fluid-lg">
            <h2>Download</h2>
          </CardTitle>
        </div>
        <CardDescription>
          Every template is single column, real selectable text, conventional
          headings, and no tables or images. That is what an applicant tracking
          system can actually read back.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-3" disabled={disabled}>
          <legend className="mb-2 text-sm font-medium">Choose a look</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {TEMPLATES.map((template) => {
              const selected = template.id === templateId;
              return (
                <label
                  key={template.id}
                  className={`card-hover relative flex cursor-pointer flex-col gap-1.5 rounded-xl border p-4 transition-colors ${
                    selected
                      ? 'border-brand-500/50 bg-brand-500/5'
                      : 'border-border'
                  }`}
                >
                  <input
                    type="radio"
                    name="template"
                    value={template.id}
                    checked={selected}
                    onChange={() => setTemplateId(template.id)}
                    className="sr-only"
                  />
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">{template.name}</span>
                    {selected ? (
                      <Check className="text-brand-600 dark:text-brand-300 size-4" aria-hidden />
                    ) : null}
                  </span>
                  <span className="text-muted-foreground text-xs leading-relaxed">
                    {template.description}
                  </span>
                  <span
                    aria-hidden
                    className="text-muted-foreground/70 mt-1 font-mono text-[0.65rem]"
                  >
                    {template.fontFamily.replace('-Roman', '')} ·{' '}
                    {template.baseFontSize}pt
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:flex-row">
          <Button asChild size="lg" disabled={disabled}>
            <a href={href('pdf')} download>
              <FileText className="size-4" aria-hidden />
              Download PDF
            </a>
          </Button>
          <Button asChild size="lg" variant="outline" disabled={disabled}>
            <a href={href('docx')} download>
              <FileText className="size-4" aria-hidden />
              Download Word
            </a>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="accepted">
            <Check className="size-3" aria-hidden />
            no blocked claims
          </Badge>
          <Badge variant="accepted">single column</Badge>
          <Badge variant="accepted">selectable text</Badge>
          <Badge variant="accepted">no tables or images</Badge>
        </div>

        <p className="text-muted-foreground text-xs leading-relaxed">
          Your name and contact details are added back to the file on our server
          at this point. They were never sent to the model.
        </p>
      </CardContent>
    </Card>
  );
}
