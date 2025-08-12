# Modules

This directory contains the application modules/features. Each module should have its own subdirectory with the following structure:

```
modules/
├── users/
│   ├── controller.js
│   ├── service.js
│   ├── model.js
│   ├── routes.js
│   └── validation.js
├── auth/
│   ├── controller.js
│   ├── service.js
│   ├── routes.js
│   └── validation.js
└── ...
```

Each module is self-contained and handles a specific domain of the application.
