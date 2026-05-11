export function getAppAccessToken(): Promise<string | null>;
export function fetchWikiNodes(): Promise<any[]>;
export function fetchDocBlocks(objToken: string): Promise<any[]>;
export function extractImageBlocks(blocks: any[]): { block_id: string; token: string; width: number; height: number }[];
export function getLocalImageUrl(token: string): string | null;
export function uploadImageToFeishu(localFilePath: string): Promise<string>;
export function appendImageBlockToDoc(objToken: string, imageToken: string, width?: number, height?: number): Promise<string | null>;
export function downloadImage(token: string): Promise<string | null>;
export function buildImageUrlMap(blocks: any[], docObjToken: string): Promise<Record<string, string>>;
export function fetchDocRawContent(objToken: string): Promise<{ document: { markdown: string } } | null>;
export function buildSectionImageMap(blocks: any[], imageUrlMap: Record<string, string>): string[][];
export function parseDocMarkdownToPrompts(
  markdown: string,
  docTitle: string,
  wikiNodeToken: string,
  objToken: string,
  imageUrlMap?: Record<string, string>,
  sectionImageMap?: string[][]
): any[];
export function categoryNameToId(name: string): string;
