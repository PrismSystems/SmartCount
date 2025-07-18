
# Smart Count User Guide

Welcome to Smart Count! This guide will walk you through all the features of the application, from creating your first project to exporting detailed reports.

## Table of Contents
1.  [Getting Started](#getting-started)
    - [Logging In & Registration](#logging-in--registration)
    - [Creating & Loading Projects](#creating--loading-projects)
2.  [The Main Interface](#the-main-interface)
    - [Sidebar Layout](#sidebar-layout)
    - [The PDF Viewer](#the-pdf-viewer)
    - [Undo & Redo](#undo--redo)
3.  [Core Features](#core-features)
    - [Symbol Takeoff (Counting)](#symbol-takeoff-counting)
    - [Linear Measurement](#linear-measurement)
    - [DALI Network Management](#dali-network-management)
4.  [Organization Tools](#organization-tools)
    - [Using Areas](#using-areas)
    - [Using Disciplines (for Symbols)](#using-disciplines-for-symbols)
    - [Using Measurement Groups](#using-measurement-groups)
5.  [Viewer Controls & Shortcuts](#viewer-controls--shortcuts)
    - [Navigation & Settings](#navigation--settings)
    - [Shortcut Reference Table](#shortcut-reference-table)
6.  [Exporting & Data Management](#exporting--data-management)
    - [Exporting to Excel](#exporting-to-excel)
    - [Exporting PDF Reports](#exporting-pdf-reports)
    - [Viewing the Counts Summary](#viewing-the-counts-summary)
    - [Backup, Restore, and Project Deletion](#backup-restore-and-project-deletion)

---

## 1. Getting Started

### Logging In & Registration
- **First-time users:** Click "Register here" to create an account. This is only for saving your work in your browser; no data is sent to a server.
- **Returning users:** Enter your email and password to log in.

### Creating & Loading Projects
- **Create New:** On the welcome screen, enter a **Project Name** and select at least one PDF. You can optionally assign a **Level** to each PDF for better organization and use a previous project as a **Template** to copy its symbol and discipline structure.
- **Load Existing:** Click on any project from the "Existing Projects" list to load it.

---

## 2. The Main Interface

### Sidebar Layout
The sidebar on the left is your main control panel. It's organized into collapsible sections:
- **Projects Dropdown (Top):** Switch between projects, create new ones, manage backups, and log out.
- **Documents:** Manage the PDFs in your current project.
- **Viewer Settings:** Adjust PDF opacity to make your markups more visible.
- **DALI Networks:** Manage DALI lighting control systems.
- **Measurements:** Manage linear measurements and scale settings.
- **Areas:** Define and manage location-based zones.
- **Symbols & Disciplines:** Your primary takeoff list for counting items.

### The PDF Viewer
This is the main area where you will interact with your floor plans and perform all takeoff work.

### Undo & Redo
Mistakes happen! Use standard keyboard shortcuts to undo or redo most actions (like placing a pin, drawing a line, or deleting an item).
- **Undo:** `Ctrl+Z` (Windows/Linux) or `Cmd+Z` (Mac)
- **Redo:** `Ctrl+Y` or `Ctrl+Shift+Z` (Windows/Linux) or `Cmd+Shift+Z` (Mac)

---

## 3. Core Features

### Symbol Takeoff (Counting)
This is for counting discrete items like outlets, fixtures, or sensors.

- **Creating a New Symbol:**
  1. In the sidebar, under "Symbols & Disciplines," click **Add Manual Symbol**.
  2. Your cursor will become a crosshair. Click and drag a box around the symbol on your PDF that you want to count.
  3. A new symbol card is created in the sidebar. You can now rename it, change its color, and assign it to a discipline.

- **Placing & Editing Pins:**
  - **Activate Symbol:** Click a symbol card in the sidebar to make it active (it will be highlighted).
  - **Place Pins (Standard):** With a symbol active, click the **Points** button. Click on the PDF to place pins. Press `Enter` or `Escape` to finish.
  - **Quick-Place Pins:** A faster way is to activate a symbol and then hold **`Ctrl`** (or `Cmd`) while clicking on the PDF. Each click adds a pin.
  - **Delete a Pin:** Simply click on any existing pin on the PDF to delete it.
  - **Reassign a Pin:** Hold **`Ctrl`** (or `Cmd`) and click on an existing pin. A modal will appear, allowing you to move that single count to a different symbol.
  - **Copy Symbol:** Use the copy icon on a symbol card to duplicate that symbol's definition into other documents within the same project.

### Linear Measurement
This is for measuring linear runs like pipes, conduits, or ductwork.

- **Setting the Scale:** Before you can measure, you must set the scale for the document.
  1.  In the "Measurements" section, click **Set Scale**.
  2.  Find a dimension on your drawing with a known length (e.g., a doorway, a scale bar).
  3.  Click on one end, then click on the other end. Press `Enter`.
  4.  A dialog box will appear. Enter the real-world length of the line you drew. The scale is now saved for this document.

- **Drawing & Editing Measurements:**
  1.  **Draw:** Click the **New** measurement button. Click on the PDF to draw your line. Hold **`Shift`** to constrain drawing to horizontal or vertical lines. Press **`Enter`** to save.
  2.  **Select for Editing:** Click on any measurement in the sidebar list. Its nodes will appear on the PDF.
  3.  **Move a Point:** While holding **`Shift`**, click and drag any node to a new position.
  4.  **Delete a Segment:** Hover over any line segment. A red 'X' will appear at its midpoint. Click it to delete the segment.
  5.  **Add Vertical Length (Risers):** With a measurement selected, click on any of its nodes. A modal will appear where you can add a manual length (e.g., for a pipe riser or drop). This length is added to the total without changing the 2D drawing.
  6.  **Add to Measurement:** Use the `+` icon on a measurement card to add more segments to an existing measurement.
  7.  **Add a Linear Component:** Hold **`Ctrl`** (or `Cmd`) and click on a measurement node to add a discrete component (like a bend, tee, or fitting) at that point. This creates a special symbol under the "Linear" discipline.

### DALI Network Management
For electrical takeoffs, manage DALI lighting control networks.

- **The DALI Manager:** This section in the sidebar is your hub for DALI takeoffs.
- **Creating Networks:** Click **Add DALI Network**. Networks are auto-named (DA1, DA2, etc.) but can be renamed.
- **Placing Devices:** On a network's card, click **Add ECG** (gear) or **Add ECD** (control device). Your cursor enters placement mode. Click on the PDF to place devices.
- **Network Card Info:** Each card shows:
    - **Bus Power:** A live calculation of the total current draw vs. the Power Supply (PSU) capacity. The bar changes color from green to yellow to red as you approach the limit.
    - **Device Counts:** Live counts of ECG and ECD devices, with warnings if you exceed recommended limits (55 for ECG, 20 for ECD).
- **The ECD Schedule:** Click **Manage ECD Schedule** to open a table where you can define all the types of control devices (sensors, switches) in your project, including their reference name and bus current draw.
- **Assigning ECD Types:** After placing an ECD on the plan, click it to assign a type from the schedule you created. This ensures accurate power calculations.
- **Deleting DALI Devices:** Hold **`Ctrl`** (or `Cmd`) and click any DALI device on the plan to delete it.
- **Device Painter:** To quickly place many copies of the same device, press `P` or use the **Device Painter** button. Click a device on the plan to copy it, then click to place copies. Press `Esc` to finish.
- **Hide/Show Labels:** Use the "Hide Labels" / "Show Labels" button in the DALI Manager to toggle the visibility of all device text labels on the PDF, reducing visual clutter.

---

## 4. Organization Tools

### Using Areas
Areas group your counts by location (e.g., "Room 101", "Apartment A").
1.  Click **Define New Area** in the sidebar.
2.  Click points on the PDF to draw a polygon. Press `Enter` to finish.
3.  Give the area a name. Any symbols placed inside this polygon will now be associated with that area in reports.

### Using Disciplines (for Symbols)
Disciplines create a hierarchical folder structure for your symbols (e.g., Electrical > Lighting > Type A).
- **Create:** Use the "Add Discipline" form in the sidebar.
- **Organize:** Drag and drop symbols into disciplines, or drag disciplines to nest them under each other.

### Using Measurement Groups
This provides the same hierarchical structure for your linear measurements.
- **Create:** Use the "Add Group" form in the "Measurements" section.
- **Organize:** Drag and drop measurements and other groups to build your structure.

---

## 5. Viewer Controls & Shortcuts

### Navigation & Settings
- **Pan:** Click and drag the PDF with your mouse wheel or the grab-hand cursor.
- **Zoom:** Use your mouse wheel.
- **Magnifier:** When placing pins or DALI devices, hold the **`Alt`** key to show a magnified view under your cursor for high-precision placement.
- **PDF Opacity:** Use the slider in the "Viewer Settings" section to fade the PDF background, making your markups easier to see.

### Shortcut Reference Table

| Action                      | Shortcut                                | Notes                                                 |
| --------------------------- | --------------------------------------- | ----------------------------------------------------- |
| **General**                 |                                         |                                                       |
| Undo                        | `Ctrl + Z`                              | Reverses the last action.                             |
| Redo                        | `Ctrl + Y` or `Ctrl + Shift + Z`        | Re-applies the last undone action.                    |
| Finish Action               | `Enter`                                 | Finishes drawing, placing pins, etc.                  |
| Cancel Action               | `Escape`                                | Cancels the current mode (drawing, placing, etc.).    |
| **Symbol Takeoff**          |                                         |                                                       |
| Quick-Place Pin             | `Ctrl + Click`                          | Places a pin for the currently active symbol.         |
| Reassign Pin                | `Ctrl + Click` (on an existing pin)     | Opens modal to move the pin to another symbol.        |
| **Linear Measurement**      |                                         |                                                       |
| Constrain Line              | Hold `Shift` (while drawing)            | Constrains drawing to 90° or 45° angles.              |
| Move Node                   | Hold `Shift` + Drag Node                | Relocates a measurement point.                        |
| Add Linear Component        | `Ctrl + Click` (on a measurement node)  | Adds a fitting/bend at that point.                    |
| **DALI**                    |                                         |                                                       |
| Activate Device Painter     | `P`                                     | Puts the app in selection mode for the painter.       |
| Delete DALI Device          | `Ctrl + Click` (on a DALI device)       | Deletes the device from the network.                  |
| **Viewer**                  |                                         |                                                       |
| Show Magnifier              | Hold `Alt` (during placement)           | Shows a magnified view for precise placement.         |

---

## 6. Exporting & Data Management

### Exporting to Excel
1.  Click **Export as Excel**.
2.  An `.xlsx` file will be downloaded with several tabs:
    - **Summary:** A roll-up of all symbol counts across the entire project.
    - **Per-Document Sheets:** A detailed symbol breakdown for each PDF, with counts separated by Area.
    - **Measurements:** A list of all linear measurements, their groups, and total lengths.
    - **DALI Schedule:** A detailed schedule of each DALI network, including device counts, power load calculations, and a bill of materials for ECD types.

### Exporting PDF Reports
- **Export PDF Report:** Generates a clean PDF of the current page view, including all your symbol pins, areas, and measurement lines burned into the document with a legend.
- **Export DALI PDF:** Generates a PDF showing only DALI devices and a summary legend for each network on the page.

### Viewing the Counts Summary
- Click **View Counts** to open a modal showing a real-time summary of all symbol counts, measurement lengths, and DALI device counts for the entire project.

### Backup, Restore, and Project Deletion
All actions are in the projects dropdown menu (top-left of the sidebar):
- **Backup All Data:** Downloads a single `.json` file containing all your projects and data. Store this file in a safe place.
- **Restore from Backup:** Select a previously saved `.json` file to restore your data. **Warning:** This will overwrite all current projects in your browser.
- **Delete Project:** Deletes the currently active project and all its data. This cannot be undone.
