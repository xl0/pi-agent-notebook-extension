# Root-level Pi package for distributability

The repo is structured as a root-level Pi package (`pi.extensions` in `package.json`) rather than a project-local `.pi/extensions` folder. This lets the notebook extension be distributed and depended on by other Pi packages. The trade-off is that the repo *is* the package — no room for unrelated project code at the root.
