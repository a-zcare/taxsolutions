import { themeInitializationScript } from '@/lib/theme';
export default function ThemeScript() {
  return (
    <script
      id="taxsolutions-theme-init"
      dangerouslySetInnerHTML={{ __html: themeInitializationScript }}
    />
  );
}
