# Image Hoisting

This context describes how images are prepared, stored, and managed across Profiles.

## Language

**Profile**:
A named image destination with its own storage and public URL configuration.

**Image Library**:
The collection of stored images available for browsing, filtering, editing, copying, and deletion within a Profile.
_Avoid_: History

**Image Library session**:
A user's current Image Library interaction state, including filters, pagination, selection, and pending edits or batch actions.
_Avoid_: Controller

**Upload session**:
A user's current path from selecting one source image through preparation and upload completion within a Profile.
_Avoid_: Upload controller

**Stored Image**:
An image object and its validated descriptive metadata inside one Profile.
_Avoid_: File record, R2 item
