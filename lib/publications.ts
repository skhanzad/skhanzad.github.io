export type ScholarMetrics = {
  citations: number;
  hIndex: number;
  i10Index: number;
};

export type Publication = {
  title: string;
  authors: string;
  venue: string;
  year: string;
  doi: string;
  abstract: string;
  citations: string;
  category: string;
  link: string;
  /** Parsed Scholar “view citation” URL */
  scholarCitationUrl?: string;
};

export type ScholarPublicationsResponse = {
  ok: boolean;
  error?: string;
  updatedAt: string;
  metrics: ScholarMetrics | null;
  publications: Publication[];
};
