export type CreativeKind = 'video' | 'image';

export type CreativeSelection = 'auto' | 'video' | 'imagen';

export interface AdCreativeSources {
  readonly videoUrl: string;
  readonly isStreamedVideo: boolean;
  readonly imageUrl: string;
  readonly posterUrl: string;
}

export interface AdCirculationDate {
  readonly day: string;
  readonly month: string;
  readonly shortYear: string;
}

export interface Ad {
  readonly libraryId: string;
  readonly copiesInRotation: number;
  readonly hasVideo: boolean;
  readonly hasLowImpressions: boolean;
  readonly brand: string;
  readonly circulationDate: AdCirculationDate | null;
  readonly sources: AdCreativeSources;
}

export interface DownloadFilters {
  readonly minimumCopiesInRotation: number;
  readonly creativeSelection: CreativeSelection;
  readonly skipLowImpressions: boolean;
  readonly includeVideoPoster: boolean;
}

export interface DownloadSessionConfig extends DownloadFilters {
  readonly maximumDownloads: number;
  readonly autoScroll: boolean;
  readonly delayBetweenDownloadsMs: number;
}

export interface DownloadOutcome {
  readonly downloaded: number;
  readonly failed: number;
  readonly skippedForLowImpressions: number;
}

export type ProgressReporter = (message: string) => void;

export type CountReporter = (attempted: number) => void;

export interface SavedFile {
  readonly fileName: string;
  readonly byteSize: number;
}

export interface ShopifyVariant {
  readonly id: number;
  readonly price: string;
}

export interface ShopifyImage {
  readonly src: string;
}

export interface ShopifyProduct {
  readonly id: number;
  readonly title: string;
  readonly handle: string;
  readonly published_at?: string;
  readonly created_at?: string;
  readonly variants?: readonly ShopifyVariant[];
  readonly images?: readonly ShopifyImage[];
}

export interface PriceRange {
  readonly lowest: number;
  readonly highest: number;
  readonly average: number;
  readonly currency: string;
}

export interface StoreInsights {
  readonly brand: string;
  readonly bestSellers: readonly ShopifyProduct[];
  readonly sellableProductCount: number;
  readonly priceRange: PriceRange;
  readonly firstPublishedAt: Date | null;
  readonly lastPublishedAt: Date | null;
}
