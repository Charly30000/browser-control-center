import { svg, type SVGTemplateResult } from "lit";

export type SectionIcon = "url" | "headers" | "cookies" | "localStorage" | "sessionStorage" | "overrides" | "viewport" | "generators";

const paths: Readonly<Record<SectionIcon, SVGTemplateResult>> = {
  url: svg`<path d="m10 13 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>`,
  headers: svg`<path d="M9 5h11M9 12h11M9 19h11"/><rect x="3" y="3" width="3" height="4" rx=".5"/><rect x="3" y="10" width="3" height="4" rx=".5"/><rect x="3" y="17" width="3" height="4" rx=".5"/>`,
  cookies: svg`<path d="M20.6 13A5 5 0 0 1 15 7a4 4 0 0 1-5-4A9 9 0 1 0 21 13Z"/><path d="M7 10h.01M9 16h.01M15 15h.01" stroke-width="3"/>`,
  localStorage: svg`<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>`,
  sessionStorage: svg`<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="12" r="6"/><path d="M12 8v4l3 2"/>`,
  overrides: svg`<path d="M3 6h10l4 4M3 18h10l4-4M17 6l4 4-4 4M17 10h4M7 6v12"/>`,
  viewport: svg`<rect x="2" y="3" width="15" height="12" rx="2"/><path d="M9 15v5M5 20h8"/><rect x="16" y="9" width="6" height="12" rx="1.5"/><path d="M18.5 18h1"/>`,
  generators: svg`<path d="m3 18 11-11 4 4L7 22ZM10 11l4 4M5 2v4M3 4h4M19 2v4M17 4h4"/>`
};

export const renderSectionIcon = (name: SectionIcon): SVGTemplateResult => svg`<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
