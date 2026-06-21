// Shared twrnc instance wired to our design tokens (tailwind.config.js).
// Pure-JS Tailwind runtime: `tw\`bg-orange p-4\`` returns a React Native style
// object — no Babel/Metro/css-interop machinery. Import this everywhere instead
// of using a `className` prop.
import { create } from 'twrnc';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const tw = create(require('../../tailwind.config.js'));

export default tw;
