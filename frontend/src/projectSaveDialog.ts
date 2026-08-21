import {
  save,
} from '@tauri-apps/plugin-dialog'

export async function chooseProjectSavePath(
  sourceFileName: string,
): Promise<string | null> {
  const baseName =
    sourceFileName.replace(
      /\.[^/.]+$/,
      '',
    ) ||
    'localization-project'

  const selectedPath =
    await save({
      defaultPath:
        `${baseName}.lhproj`,

      filters: [
        {
          name:
            'LocalizationHub Project',

          extensions: [
            'lhproj',
          ],
        },
      ],
    })

  return selectedPath ?? null
}