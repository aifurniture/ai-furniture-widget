/**
 * Global types for the AI Furniture Widget (window.FURNITURE_AI_CONFIG, etc.).
 * Include this in your TypeScript project so window.FURNITURE_AI_CONFIG is typed.
 */
export {};

declare global {
  interface Window {
    /** Set before loading the widget script to configure domain and domainId. */
    FURNITURE_AI_CONFIG?: {
      domain: string;
      domainId: string;
      position?: string;
      debug?: boolean;
      bigCommerceStore?: boolean;
      productUrl?: string;
      productTitle?: string;
      [key: string]: unknown;
    };
    /** Widget API after script loads: initAIFurnitureWidget(config) */
    AIFurnitureWidget?: {
      initAIFurnitureWidget: (config?: Record<string, unknown>) => void;
    };
    /** Legacy init function (same as AIFurnitureWidget.initAIFurnitureWidget). */
    initAIFurnitureWidget?: (config?: Record<string, unknown>) => void;
  }
}
