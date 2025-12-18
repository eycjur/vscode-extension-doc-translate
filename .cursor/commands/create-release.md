# Create Release

Executes the steps to create a release.

## Steps

1. **Update version in package.json**
   - Check the current version
   - Ask the user to confirm and input the new version number
   - Update the `version` field in package.json to the new version

2. **Check previous version using git tag**
   - Check if a tag exists for the previous version (e.g., v1.1.2)
   - If it doesn't exist, get the latest tag using git tag (`git tag --sort=-version:refname | head -1`)
   - Use the latest tag as the baseline

3. **Get diff using git diff**
   - Get the diff from the latest tag to the current HEAD (`git diff <latest-tag>..HEAD`)
   - Get the list of changed files
   - Get the list of commit messages (`git log <latest-tag>..HEAD --oneline`)

4. **Update CHANGELOG.md**
   - Add a new section with the new version number at the top of CHANGELOG.md
   - Use today's date in YYYY-MM-DD format
   - Analyze the content of git diff and commit messages, and categorize them into the following categories:
     - ✨ New Features
     - 🔧 Improvements & Fixes
     - 📝 Documentation
     - 🐛 Bug Fixes
     - ⚠️ Breaking Changes
   - Categorize and describe each change appropriately
   - Follow the existing CHANGELOG.md format (Keep a Changelog format)

## Notes

- Version numbers should follow semantic versioning (e.g., 1.1.3)
- Maintain the existing CHANGELOG.md format
- If the change content is unclear, ask the user for confirmation
