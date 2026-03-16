---
name: Example Knowledge File
description: Template showing how to create custom knowledge files for AI agents
tags: example, template
---

# How to Create Knowledge Files

Place `.md` or `.txt` files in this `knowledge/` directory, or host them on a GitHub repo.

## Frontmatter (optional)

```
---
name: My Business Rules
description: E-commerce business rules and policies
tags: business, rules
---
```

## Use Cases

- **Business rules**: Shipping policies, return policies, pricing rules
- **Coding standards**: Naming conventions, code review checklist
- **API documentation**: External API specs, webhook formats
- **Product guidelines**: Brand tone of voice, content templates
- **Custom workflows**: Step-by-step processes the AI should follow

## GitHub Repo

Set `WEBCAKE_KNOWLEDGE_REPO` to load from a GitHub repo:

```json
{ "env": { "WEBCAKE_KNOWLEDGE_REPO": "your-org/knowledge-base" } }
```

For private repos, also set `WEBCAKE_KNOWLEDGE_TOKEN`.
