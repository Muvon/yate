# YATE - Yet Another Template Engine

YATE is a lightweight and efficient template engine for JavaScript applications. It allows you to compile HTML-based templates into JavaScript functions for fast rendering.

## Features

- HTML-based template syntax
- Compiles templates to JavaScript functions
- Supports both browser and Node.js environments
- Asynchronous file processing
- Modular output for easy integration

## Installation

```bash
npm install yate
```

## Usage

### Node.js

```javascript
const yate = require('yate');
const compile = require('yate/compile');

// Compile templates
compile(['template1.html', 'template2.html'], true)
  .then((compiledTemplates) => {
    // Use compiled templates
    const templates = yate.pool(compiledTemplates);
    const result = templates.template1({ data: 'example' });
    console.log(result);
  })
  .catch((error) => {
    console.error('Compilation error:', error);
  });
```

### Browser

```html
<script src="yate.js"></script>
<script src="compiled-templates.js"></script>
<script>
  // Use compiled templates
  const result = window.templates.template1({ data: 'example' });
  console.log(result);
</script>
```

## API

### `compile(files, asModule)`

Compiles the specified template files.

- `files`: A single file path or an array of file paths to compile.
- `asModule`: Boolean indicating whether to output as a Node.js module (true) or browser-ready code (false).

Returns a Promise that resolves to the compiled template code.

### `yate.pool(templateList)`

Creates a pool of compiled templates.

- `templateList`: An object containing compiled template functions.

Returns an object with methods to render the compiled templates.

## Template Syntax

YATE uses HTML-based syntax for templates. Detailed documentation on the template syntax will be provided separately.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the [MIT License](LICENSE).
