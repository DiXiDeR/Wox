import { Theme } from "../entity/Theme.typings"
import { getTheme } from "../api/WoxAPI.ts"
import { WoxLogHelper } from "./WoxLogHelper.ts"
import { WoxUIHelper } from "./WoxUIHelper.ts"

export class WoxThemeHelper {
  private static instance: WoxThemeHelper
  private static currentTheme: Theme

  static getInstance(): WoxThemeHelper {
    if (!WoxThemeHelper.instance) {
      WoxThemeHelper.instance = new WoxThemeHelper()
    }
    return WoxThemeHelper.instance
  }

  private constructor() {}

  public async loadTheme() {
    const apiResponse = await getTheme()
    WoxLogHelper.getInstance().log(`load theme: ${JSON.stringify(apiResponse.Data)}`)
    WoxThemeHelper.currentTheme = apiResponse.Data
    await WoxUIHelper.getInstance().setBackgroundColor(WoxThemeHelper.currentTheme.AppBackgroundColor)
  }

  public async changeTheme(theme: Theme) {
    WoxLogHelper.getInstance().log(`change theme: ${JSON.stringify(theme.ThemeName)}`)
    WoxThemeHelper.currentTheme = theme
  }

  public getTheme() {
    return WoxThemeHelper.currentTheme || ({} as Theme)
  }
}