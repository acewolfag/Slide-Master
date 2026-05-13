# Mobile UI Fix TODO (User + Admin)

- [x] 1. Update `artifacts/2grils-ppt/src/pages/admin/index.tsx`
  - [x] Add safer mobile layout constraints (`w-full`, `overflow-x-hidden`)
  - [x] Fix mobile sidebar sheet/footer flow to avoid overlap blocking taps
- [x] 2. Update `artifacts/2grils-ppt/src/pages/admin/orders.tsx`
  - [x] Normalize nested mobile padding
  - [x] Ensure wrapper does not introduce horizontal/interaction issues
- [x] 3. Update `artifacts/2grils-ppt/src/pages/admin/templates.tsx`
  - [x] Make form grids responsive for small screens
  - [x] Improve sticky action footer behavior on mobile
  - [x] Normalize page spacing
- [ ] 4. Update `artifacts/2grils-ppt/src/index.css`
  - [ ] Add global overflow-x protection for mobile
  - [ ] Add touch interaction safety tweaks
- [ ] 5. Validation
  - [ ] Run quick check/build to catch regressions
  - [ ] Summarize changes and expected mobile behavior improvements
