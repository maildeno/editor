# Contributing to Maildeno

Thank you for your interest in contributing to Maildeno.

Maildeno is an open-source email template builder and rendering platform for developers. The Maildeno Editor is designed to make it easy to visually build responsive email templates while keeping the resulting templates useful in real production applications.

We welcome contributions of all kinds — bug fixes, improvements, documentation, tests, examples, and new features.

Please read this guide before opening an issue or pull request.

## Quick Links

* [Getting Started](#getting-started)
* [Project Structure](#project-structure)
* [Development Workflow](#development-workflow)
* [Testing](#testing)
* [Branching and Commits](#branching-and-commits)
* [Pull Requests](#pull-requests)
* [Bug Reports](#bug-reports)
* [Feature Requests](#feature-requests)
* [Documentation](#documentation)
* [Licensing](#licensing)

---

## Code of Conduct

By participating in the Maildeno community, you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

We expect all contributors to be respectful, constructive, and professional.

---

## What We Are Looking For

We welcome contributions that improve Maildeno for developers and their users.

Examples include:

* Bug fixes
* New editor features
* Editor extensions and improvements
* New email blocks
* Improvements to merge tags and visibility rules
* Rendering improvements
* Accessibility improvements
* Performance improvements
* TypeScript improvements
* Test coverage
* Documentation improvements
* Examples and integration guides
* Developer experience improvements
* Build and tooling improvements

Before working on a large feature, please open an issue first so we can discuss the proposed approach.

---

## Getting Started

### Prerequisites

Maildeno is a JavaScript/TypeScript project.

You should have:

* Node.js
* npm
* Git

Check your installed versions:

```bash
node --version
npm --version
git --version
```

Use the Node.js version specified by the repository's configuration files when applicable.

### Fork the Repository

Fork the Maildeno repository on GitHub and clone your fork:

```bash
git clone https://github.com/maildeno/editor.git
cd editor
```

Add the upstream repository:

```bash
git remote add upstream https://github.com/maildeno/editor.git
```

Verify your remotes:

```bash
git remote -v
```

### Install Dependencies

Install the workspace dependencies from the repository root:

```bash
npm install
```

Do not install dependencies separately inside individual workspace packages unless the package documentation specifically requires it.

---

## Project Structure

Maildeno uses an npm workspace monorepo.

The repository is organized around the editor package and its development applications.

A typical structure looks like:

```text
.
├── apps/
│   └── playground/
│
├── packages/
│   └── editor/
│
├── package.json
├── package-lock.json
└── README.md
```

### `packages/editor`

This is the Maildeno Editor package.

Changes to the editor itself should generally be made here.

### `apps/playground`

The playground is used for developing and testing the editor during development.

The playground is not the published npm package.

When developing a feature, use the playground to verify the behavior of the editor before opening a pull request.

---

## Development Workflow

Start by creating a branch from the latest `main` branch:

```bash
git fetch upstream
git checkout main
git pull upstream main
```

Create a topic branch:

```bash
git checkout -b feat/custom-block-support
```

Make your changes, test them locally, and commit them using the conventions described below.

Keep changes focused.

A pull request should generally solve one problem or implement one clearly defined feature.

---

## Running the Project

Install dependencies from the repository root:

```bash
npm install
```

Run the development environment using the project's documented development script:

```bash
npm run dev
```

If you are working specifically on the editor package, use the package's development/build scripts where appropriate.

Before submitting a pull request, make sure the package can be built successfully:

```bash
npm run build
```

If the repository provides additional linting, type-checking, or test scripts, run the relevant commands for the area you changed.

Do not ignore build or type errors introduced by your changes.

---

## Testing

Every bug fix or feature should include appropriate tests when practical.

At minimum, verify that:

* The changed functionality works as expected.
* Existing functionality still works.
* The editor builds successfully.
* TypeScript errors have not been introduced.
* Relevant UI behavior has been manually tested in the playground.

For changes involving email rendering, also verify the generated output where applicable.

For changes involving:

* merge tags
* visibility rules
* template serialization
* editor state
* export formats
* rendering

tests should cover both normal and edge-case behavior where practical.

### Don't Break Existing Behavior

Maildeno is an editor used to generate production email templates.

A change that appears visually minor can affect exported email HTML or template JSON.

When changing editor behavior, consider:

* Existing templates
* Template JSON compatibility
* Exported HTML
* MJML output
* React Email output
* Merge tag behavior
* Visibility rules
* Responsive behavior
* Email-client compatibility

---

## Branching and Commits

### Branch Naming

Use the following format:

```text
<type>/<short-description>
```

Recommended branch types:

| Type       | Purpose                 | Example                     |
| ---------- | ----------------------- | --------------------------- |
| `feat`     | New feature             | `feat/custom-blocks`        |
| `fix`      | Bug fix                 | `fix/merge-tag-escaping`    |
| `refactor` | Code restructuring      | `refactor/editor-state`     |
| `perf`     | Performance improvement | `perf/editor-rendering`     |
| `test`     | Tests                   | `test/visibility-rules`     |
| `docs`     | Documentation           | `docs/custom-blocks`        |
| `chore`    | Maintenance             | `chore/update-dependencies` |

Examples:

```text
feat/custom-blocks
fix/visibility-rule-preview
refactor/editor-state
perf/template-rendering
test/merge-tags
docs/getting-started
chore/update-dependencies
```

---

## Commit Messages

Maildeno follows [Conventional Commits](https://www.conventionalcommits.org/).

Use:

```text
<type>(<scope>): <description>
```

Examples:

```text
feat(editor): add custom block support
fix(merge-tags): escape attribute values correctly
fix(editor): prevent invalid nested columns
refactor(editor): simplify selection state
perf(editor): reduce unnecessary node updates
test(editor): add visibility rule coverage
docs(editor): document custom extensions
chore(deps): update tiptap dependencies
```

Use the imperative form:

```text
feat(editor): add custom block support
```

not:

```text
feat(editor): added custom block support
```

Keep commit messages short and descriptive.

---

## Pull Requests

Before opening a pull request:

1. Make sure your branch is based on the latest `main`.
2. Build the project successfully.
3. Run relevant tests and checks.
4. Test the change in the playground when applicable.
5. Update documentation if the change affects public behavior.
6. Review your own diff before submitting the PR.

Push your branch:

```bash
git push origin feat/custom-blocks
```

Then open a pull request against `main`.

### Pull Request Description

A good pull request should explain:

* What changed?
* Why was it changed?
* How does it work?
* How was it tested?
* Are there any compatibility considerations?

For example:

```text
## What changed

Added support for registering custom editor blocks.

## Why

Applications embedding Maildeno need to provide their own
domain-specific email components.

## Testing

- Tested custom block insertion in the playground
- Tested serialization/deserialization
- Ran the production build
```

If the PR fixes an issue, reference it:

```text
Fixes #123
```

---

## Keep Pull Requests Focused

Avoid combining unrelated changes in one PR.

For example, don't submit a single PR containing:

* a new editor feature
* dependency upgrades
* unrelated CSS changes
* documentation rewrites
* refactoring of unrelated components

Smaller PRs are easier to review, test, and merge.

---

## Backward Compatibility

Maildeno templates may be stored and rendered outside of the editor.

Changes to the following areas require particular care:

* Template JSON
* Schema versions
* Node attributes
* Merge tags
* Visibility rules
* Export formats
* Public SDK APIs
* Editor configuration
* Public TypeScript types

If a change can break existing templates or consumers, explain the compatibility impact in the pull request.

When necessary, introduce a migration or schema-version change rather than silently changing the existing format.

---

## Bug Reports

Before opening a bug report, search existing GitHub issues to make sure the problem has not already been reported.

A useful bug report should include:

* A clear title
* Steps to reproduce
* Expected behavior
* Actual behavior
* Operating system
* Node.js version
* Browser and version, if relevant
* Maildeno version or commit
* Relevant console errors
* A minimal reproduction, if possible
* Screenshots or recordings for visual issues

For editor bugs, a minimal reproduction is especially valuable.

If the problem involves a specific template, include a sanitized example of the relevant template structure when possible.

Do not include secrets, API keys, passwords, customer data, or other sensitive information in an issue.

---

## Feature Requests

Feature requests are welcome.

Before proposing a large feature, explain:

* The problem you are trying to solve.
* Who would benefit from it.
* How you expect it to work.
* Why the existing functionality is insufficient.
* Whether you are willing to contribute the implementation.

For editor features, consider whether the feature should be:

* Core editor functionality
* An extension
* A custom block
* A host-application integration
* A rendering feature

This helps keep the core editor focused and maintainable.

---

## Documentation

Documentation contributions are always welcome.

You can help by:

* Fixing errors
* Improving explanations
* Adding examples
* Clarifying API behavior
* Adding integration guides
* Documenting edge cases
* Improving onboarding

If you change public behavior, update the relevant documentation as part of the same pull request whenever possible.

---

## Code Style

Keep code consistent with the existing project.

In particular:

* Prefer TypeScript for new application/library code where appropriate.
* Follow the existing Vue and TypeScript patterns.
* Avoid unnecessary abstractions.
* Avoid introducing dependencies for problems that can be solved simply with existing utilities.
* Keep public APIs small and predictable.
* Prefer readable code over clever code.
* Preserve existing behavior unless the change intentionally modifies it.
* Do not leave debugging statements such as `console.log()` in production code unless they are intentionally part of the implementation.

Do not make broad formatting changes unrelated to your contribution.

---

## Dependencies

Please think carefully before adding a dependency.

When proposing a new dependency, consider:

* Is the functionality already available in the project?
* Is the dependency actively maintained?
* What is its license?
* What is its bundle/runtime impact?
* Does it introduce security or supply-chain risk?
* Is it necessary for the feature?

Dependency changes should be explained in the pull request when they materially affect the project.

---

## Security

Do not report security vulnerabilities through public GitHub issues.

If you discover a security vulnerability, report it privately through the repository's security reporting mechanism.

Never publish:

* API keys
* access tokens
* passwords
* private customer data
* production credentials
* private template data

in issues, pull requests, commits, or examples.

---

## Licensing

Maildeno is open source and licensed under the **MIT License**.

By submitting a contribution to Maildeno, you agree that your contribution may be distributed under the project's applicable license.

See [LICENSE](LICENSE) for the complete license text.

---

## Release Process

Releases are maintained by the Maildeno maintainers.

Contributors generally should not manually modify package versions unless a maintainer specifically requests it.

Version changes, changelogs, npm publishing, and release automation are handled as part of the project's release process.

---

## Maintainer Review

Submitting a pull request does not guarantee that it will be merged.

Maintainers may:

* Request changes
* Ask for additional tests
* Suggest a different implementation
* Close duplicate proposals
* Decline changes that do not fit Maildeno's goals
* Request that a feature be implemented as an extension rather than in core

The goal of review is to keep Maildeno maintainable, reliable, and useful to the wider community.

---

## Thank You

Every contribution helps make Maildeno better.

Whether you're fixing a typo, improving accessibility, fixing an email rendering bug, adding a new editor capability, or helping another developer through an issue, thank you for contributing to Maildeno.
