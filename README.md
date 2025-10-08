# Live Jinja Parser 🐍

**The ultimate online Jinja2 template renderer, editor, and tester** - no installation required! A powerful, browser-based Jinja2 template engine that runs Python's official Jinja2 library directly in your web browser using Pyodide.

Perfect for developers who need to **render Jinja2 templates online**, **test Jinja template syntax**, **debug template variables**, or **learn Jinja2 templating** without setting up a local Python environment. Whether you're working with Flask templates, Ansible playbooks, or any Jinja2-based templating system, this live renderer provides instant feedback and professional debugging tools.

## 🔍 Keywords
**Jinja2 online renderer** • **Jinja template tester** • **Live Jinja2 editor** • **Browser-based template engine** • **Jinja2 debugger** • **Template variable extractor** • **Online Python Jinja** • **Jinja2 playground** • **Template syntax checker** • **Real-time Jinja rendering**

## 🚀 Features

### ✨ Core Functionality
- **Live Template Rendering**: Real-time Jinja2 template processing using Python's actual Jinja2 library via Pyodide
- **Auto-Rerender**: Automatically updates output as you type (can be toggled on/off)
- **Manual Rerender**: Option to disable auto-rendering and manually trigger updates
- **Syntax Highlighting**: Full Jinja2 syntax highlighting with CodeMirror

### 🔧 Variable Management
- **Intelligent Variable Extraction**: Automatically detects and extracts variables from your templates
- **Dual Input Modes**: 
  - **JSON Mode**: Direct JSON editing with syntax highlighting
  - **Form Mode**: Dynamic form generation with individual input fields for each variable
- **Smart Structure Detection**: Recognizes objects, arrays, loops, and conditional variables
- **Variable Preservation**: Maintains existing variable values when extracting new ones

### 📝 Editor Features
- **Multi-Panel Layout**: Split view with template, variables, and output panels
- **Text Wrapping Toggle**: Enable/disable line wrapping for better readability
- **Copy Functionality**: One-click copying of templates and output
- **Responsive Design**: Fully responsive interface that works on all screen sizes

### 👁️ Visualization & Debugging
- **Whitespace Visualization**: Toggle to show spaces (·), tabs (→), and newlines (↵)
- **Error Handling**: Clear error messages for template syntax and JSON parsing errors
- **Loading States**: Visual feedback during Python environment initialization

### 🎛️ Layout Customization
- **Resizable Panels**: Drag handles to resize template, variables, and output panels
- **Window Resizing**: Responsive layout that adapts to window size changes
- **Persistent Layout**: Maintains panel proportions during interactions

### ⚡ Performance & Technology
- **Pyodide Integration**: Full Python Jinja2 implementation running in the browser
- **No Server Required**: Complete client-side solution
- **Modern JavaScript**: ES6+ with efficient event handling and debouncing
- **CodeMirror Integration**: Professional code editing experience

## 🛠️ Technical Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Python Runtime**: [Pyodide](https://pyodide.org/) v0.25.1
- **Template Engine**: Jinja2 (running in browser via Pyodide)
- **Code Editor**: [CodeMirror](https://codemirror.net/) v5.65.15
- **Styling**: Custom CSS with CSS variables for theming

## 🎯 Use Cases

- **Template Development**: Rapid prototyping and testing of Jinja2 templates
- **Learning Jinja2**: Interactive environment for learning template syntax
- **Documentation**: Generate examples and test edge cases
- **Debugging**: Visualize whitespace and troubleshoot template issues
- **Code Review**: Share and review templates without server setup

## 🚀 Getting Started

1. **Clone or Download**: Get the project files
2. **Open in Browser**: Simply open `index.html` in a modern web browser
3. **Wait for Initialization**: The Python environment loads automatically (first load takes ~10-30 seconds)
4. **Start Templating**: Begin writing Jinja2 templates in the left panel

### Example Templates

```jinja2
Hello {{ name }}!

{% if user.authenticated %}
Welcome back, {{ user.name }}!
{% else %}
Please log in to continue.
{% endif %}

{% for item in items %}
- {{ item.name }}: ${{ item.price }}
{% endfor %}
```

## 🔧 Key Features Breakdown

### Auto Variable Extraction
The tool intelligently analyzes your template and creates appropriate variable structures:
- Detects simple variables: `{{ name }}` → creates string input
- Identifies objects: `{{ user.name }}` → creates nested object structure
- Recognizes arrays: `{% for item in items %}` → creates array input
- Handles complex patterns: Loop variables with properties, conditional checks, array access

### Dual Input Modes
- **JSON Mode**: Full control with direct JSON editing, perfect for complex data structures
- **Form Mode**: User-friendly individual inputs, ideal for simple variables and quick testing

### Responsive Layout System
- **Horizontal Resize**: Adjust template vs. variables panel height
- **Vertical Resize**: Control left panels vs. output panel width  
- **Window Adaptation**: Automatically adjusts to browser window changes
- **Minimum Constraints**: Prevents panels from becoming too small

### Whitespace Visualization
Toggle to see hidden characters:
- Spaces appear as middle dots (·)
- Tabs show as arrows (→)  
- Newlines display as return symbols (↵)
- Original text layout preserved for accurate copying

## 🌐 Browser Compatibility

- **Chrome/Chromium**: Full support
- **Firefox**: Full support  
- **Safari**: Full support
- **Edge**: Full support

*Note: First load requires internet connection to download Pyodide runtime*

## 📱 Mobile Support

While optimized for desktop development, the interface is fully responsive and functional on tablets and mobile devices with appropriate touch interactions for resizing and editing.

## 🤝 Contributing

Feel free to submit issues, feature requests, or pull requests. This project aims to be a comprehensive tool for Jinja2 development in the browser.

## 📄 License

Open source - see individual component licenses for Pyodide, CodeMirror, and other dependencies.

---

**Live Jinja Parser** - Making Jinja2 template development fast, visual, and accessible anywhere you have a browser! 🚀