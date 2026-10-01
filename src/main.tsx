import '@fontsource-variable/cairo'; // bundled (no Google request): Arabic + Latin, works offline
import { render } from 'preact';
import { App } from './app';
import './i18n'; // sets <html lang/dir> before first paint
import './styles.css';

render(<App />, document.getElementById('app')!);
