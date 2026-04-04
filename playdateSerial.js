// Playdate Serial Communication Module
// Handles Web Serial API connection and datadisk command

(function (global) {
  "use strict";

  // Playdate USB Vendor/Product IDs
  const PLAYDATE_VENDOR_ID = 0x1331; // 4913 in decimal
  const PLAYDATE_PRODUCT_ID_SERIAL = 0x5740; // 22336 in decimal (Serial/CDC mode)

  /**
   * Request a serial port connection to Playdate
   * @returns {Promise<SerialPort|null>} The serial port or null if cancelled
   */
  async function requestPlaydatePort() {
    try {
      const filters = [
        {
          usbVendorId: PLAYDATE_VENDOR_ID,
          usbProductId: PLAYDATE_PRODUCT_ID_SERIAL,
        },
      ];

      const port = await navigator.serial.requestPort({ filters });
      return port;
    } catch (error) {
      if (error.name === "NotFoundError") {
        console.log("No Playdate selected or available");
      } else {
        console.error("Error requesting serial port:", error);
      }
      return null;
    }
  }

  /**
   * Open a serial port with the correct baud rate for Playdate
   * @param {SerialPort} port
   * @returns {Promise<boolean>}
   */
  async function openPort(port) {
    try {
      await port.open({ baudRate: 115200 });
      return true;
    } catch (error) {
      console.error("Error opening serial port:", error);
      return false;
    }
  }

  /**
   * Send the datadisk command to put Playdate into Data Disk mode
   * @param {SerialPort} port
   * @returns {Promise<boolean>}
   */
  async function sendDatadiskCommand(port) {
    try {
      const encoder = new TextEncoder();
      const writer = port.writable.getWriter();

      await writer.write(encoder.encode("datadisk\n"));
      await writer.releaseLock();

      console.log("Datadisk command sent successfully");
      return true;
    } catch (error) {
      console.error("Error sending datadisk command:", error);
      return false;
    }
  }

  /**
   * Close the serial port connection
   * @param {SerialPort} port
   * @returns {Promise<boolean>}
   */
  async function closePort(port) {
    try {
      await port.close();
      return true;
    } catch (error) {
      console.error("Error closing serial port:", error);
      return false;
    }
  }

  /**
   * Main function to connect to Playdate and send datadisk command
   * This is the primary entry point - call this to trigger Data Disk mode
   * @returns {Promise<boolean>}
   */
  async function enterDataDiskMode() {
    console.log("Attempting to connect to Playdate...");

    // Check if Web Serial API is supported
    if (!("serial" in navigator)) {
      console.error("Web Serial API not supported in this browser");
      return false;
    }

    const port = await requestPlaydatePort();
    if (!port) {
      console.log("Connection cancelled or no Playdate available");
      return false;
    }

    console.log("Playdate selected, opening port...");

    const opened = await openPort(port);
    if (!opened) {
      console.error("Failed to open serial port");
      return false;
    }

    console.log("Port opened, sending datadisk command...");

    const sent = await sendDatadiskCommand(port);
    if (!sent) {
      console.error("Failed to send datadisk command");
      await closePort(port);
      return false;
    }

    // Close the port after sending command
    // (Playdate will disconnect anyway when it reboots into Data Disk mode)
    await closePort(port);

    console.log("✅ Playdate rebooting into Data Disk mode...");
    console.log(
      "⏳ Wait for Playdate to appear as a disk, then press MENU button again to select folder",
    );

    return true;
  }

  // Expose the main function globally
  global.PlaydateSerial = {
    enterDataDiskMode,
  };
})(window);
