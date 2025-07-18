
# Smart Count - DALI Network User Guide

This guide provides a comprehensive walkthrough of the DALI (Digital Addressable Lighting Interface) network management features within Smart Count. This tool is designed to help electrical engineers and designers plan, count, and verify DALI lighting control systems directly on their PDF floor plans.

## Table of Contents
1.  [Understanding the DALI Feature](#1-understanding-the-dali-feature)
2.  [The DALI Manager Interface](#2-the-dali-manager-interface)
3.  [Step 1: Configure the ECD Schedule (Crucial First Step)](#3-step-1-configure-the-ecd-schedule-crucial-first-step)
4.  [Step 2: Create and Manage DALI Networks](#4-step-2-create-and-manage-dali-networks)
5.  [Step 3: Place DALI Devices on the PDF](#5-step-3-place-dali-devices-on-the-pdf)
6.  [Step 4: Edit Devices and Export Reports](#6-step-4-edit-devices-and-export-reports)
7.  [Recommended Workflow Summary](#7-recommended-workflow-summary)

---

### 1. Understanding the DALI Feature

The DALI tools in Smart Count allow you to place and manage two primary types of DALI devices:

-   **ECG (Electronic Control Gear):** These are typically the drivers that control the light fittings. They are the "gear." In the app, they are represented by **orange circles**.
-   **ECD (Electronic Control Device):** These are control inputs like switches, occupancy sensors (PIRs), or light sensors. They are the "controls." In the app, they are represented by **cyan squares**.

The primary goal of this feature is to ensure your network designs are valid by automatically tracking device counts and calculating the total electrical load (bus current) on each network.

### 2. The DALI Manager Interface

You can find the **DALI Networks** section in the main sidebar. This is your central hub for all DALI-related actions.

It contains several main action buttons:
-   **Manage ECD Schedule:** Opens a table to define the types of control devices (ECDs) in your project.
-   **Add DALI Network:** Creates a new, empty DALI network card.
-   **Device Painter:** A tool to quickly copy and place identical devices.
-   **Hide/Show Labels:** A toggle button to show or hide all the text labels (`DA1.00`, etc.) for DALI devices on the plan. This is useful for decluttering a busy drawing.
-   **Export DALI PDF:** Generates a PDF report of the DALI devices on the current page.

### 3. Step 1: Configure the ECD Schedule (Crucial First Step)

Before placing any devices, it is highly recommended to set up your ECD Schedule. This schedule acts as a library of all the control devices you plan to use. Defining them here ensures your bus power calculations will be accurate.

1.  Click **Manage ECD Schedule**. This opens a modal window.
2.  Use the form at the bottom to add a new device type.
    -   **Reference:** A short name or code for the device (e.g., "PIR-CM", "SW-2B"). This will appear on the PDF.
    -   **Bus Current (mA):** The most important field. Enter the device's current draw in milliamps, as specified by the manufacturer.
    -   **Product Code & Description:** Optional fields for your reference.
3.  Click **Add Type** to save it to the schedule table.
4.  Repeat for all ECDs in your project. You can edit or delete types from the table at any time.

### 4. Step 2: Create and Manage DALI Networks

Now you can create the networks that will host your devices.

1.  Click **Add DALI Network**. A new card will appear in the sidebar, automatically named (e.g., "DA1").
2.  **Configure the Network Card:** Each card gives you full control over the network's properties.
    -   **Rename:** Click the network name (e.g., "DA1") to edit it.
    -   **Bus Power:** This is a live-calculated progress bar. It shows the total current draw of all devices on the network versus the capacity of the power supply (PSU).
        -   The bar turns **yellow** when the load exceeds 75% and **red** when it exceeds 90% or is overloaded.
    -   **Device Counts:** Shows the current count of ECG and ECD devices against their limits.
        -   The app will warn you if you exceed the recommended limits (55 ECG, 20 ECD) and allows you to increase to the hard limits (64 ECG, 32 ECD) if necessary.
    -   **PSU (mA):** Set the capacity of your DALI Power Supply Unit here. The default is 250 mA.
    -   **Default ECD:** To speed up your workflow, select an ECD type from your schedule here. Any new ECDs you place on this network will automatically be assigned this type.
    -   **Visibility/Delete:** Use the eye icon to show/hide the network's devices on the PDF, or the trash icon to delete the network.

### 5. Step 3: Place DALI Devices on the PDF

Once your network is configured, you can start your takeoff.

1.  On the desired network card, click **Add ECG** or **Add ECD**.
2.  Your cursor will change, and a banner will appear at the top indicating you are in placement mode.
3.  Click anywhere on the PDF to place a device.
    -   A label will automatically appear (e.g., `DA1.00` for an ECG, `DA1.100` for an ECD), indicating the network name and its unique short address.
4.  Press `Enter` or `Escape` to exit placement mode.

**Pro Tip:** Hold the **`Alt`** key while placing devices to activate a magnifier for high-precision placement.

#### Using the Device Painter (Pro Feature)
To quickly place many identical devices (e.g., the same PIR sensor across an office floor):
1.  Use the **Device Painter** button in the DALI Manager or press the **`P`** key on your keyboard.
2.  Your cursor will change. Click on an existing device on the plan to "pick it up" as a template.
3.  The banner will update, and a preview will follow your cursor. Now, every click on the PDF will place an identical copy.
4.  Press `Enter` or `Escape` to finish painting.

### 6. Step 4: Edit Devices and Export Reports

-   **Assigning an ECD Type:** After placing an ECD, simply click on it on the PDF. This will open the "Assign ECD Type" modal. Select the correct type from your schedule. The device's label on the PDF will update to include the reference (e.g., `DA1.100 [PIR-CM]`), and the network's bus power calculation will update instantly.
-   **Deleting a Device:** Hold **`Ctrl`** (or `Cmd` on Mac) and click on any DALI device on the PDF to delete it.
-   **Exporting:** When you are ready, click **Export DALI PDF**. This generates a clean PDF of the current page showing only the DALI devices and a legend summarizing the device counts for each visible network.

### 7. Recommended Workflow Summary

For the most efficient and accurate DALI takeoff, follow this workflow:

1.  **Start by clicking `Manage ECD Schedule`** and defining all the ECD types for your project.
2.  **Click `Add DALI Network`** to create all the networks you need.
3.  For each network card, **set the correct PSU capacity** and select a **Default ECD** type if applicable.
4.  Use the **`Add ECG`** and **`Add ECD`** buttons to place all devices on the plan. For repetitive devices, use the **Device Painter** (`P` key).
5.  Go back and **click on individual ECDs** to assign specific types where needed (e.g., for different sensor models).
6.  Continuously **monitor the Bus Power and Device Count** indicators on the network cards to ensure your design remains valid.
7.  **Export the DALI PDF** for a clean, professional report of your design for that sheet.
