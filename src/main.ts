import '@shoelace-style/shoelace/dist/themes/dark.css';
import { setBasePath } from '@shoelace-style/shoelace/dist/utilities/base-path.js';
import './styles/tokens.css';
import './styles/shoelace-theme.css';
import './styles/global.css';

setBasePath('/node_modules/@shoelace-style/shoelace/dist');

import './app-shell.ts';
