// Vitest stub — the real library ships uncompiled RN/Flow source that the
// node test environment cannot parse. The render test only walks element
// trees, so host-component markers are all it needs.
export const FlexWidget = 'FlexWidget' as unknown as (p: unknown) => null;
export const TextWidget = 'TextWidget' as unknown as (p: unknown) => null;
export type WidgetTaskHandlerProps = Record<string, unknown>;
export function requestWidgetUpdate(): Promise<void> {
  return Promise.resolve();
}
export function registerWidgetTaskHandler(): void {}
