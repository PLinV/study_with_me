import '@fontsource/vt323';
import '@fontsource/press-start-2p';
import './style.css';

import { createApp } from 'vue';
import App from './App.vue';

// Spotify n'accepte que 127.0.0.1 comme adresse de retour locale.
if (location.hostname === 'localhost') {
  location.replace(location.href.replace('//localhost', '//127.0.0.1'));
} else {
  createApp(App).mount('#app');
}
