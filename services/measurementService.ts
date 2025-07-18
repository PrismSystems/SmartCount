
import type { LinearMeasurement, ScaleInfo } from '../types';

export const measurementService = {
    /**
     * Calculates the on-page (2D) length of a measurement based on its points and the PDF scale.
     */
    calculateDrawnLength(measurement: LinearMeasurement, scaleInfo: ScaleInfo | undefined): number {
        if (!scaleInfo || scaleInfo.linePixels === 0) return 0;

        let totalPixels = 0;
        measurement.points.forEach(segment => {
            for (let i = 0; i < segment.length - 1; i++) {
                const p1 = segment[i];
                const p2 = segment[i + 1];
                totalPixels += Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
            }
        });

        const unitsPerPixel = scaleInfo.knownLength / scaleInfo.linePixels;
        return totalPixels * unitsPerPixel;
    },

    /**
     * Calculates the sum of all manually added vertical lengths.
     */
    calculateManualLength(measurement: LinearMeasurement): number {
        if (!measurement.manualEntries) return 0;
        return measurement.manualEntries.reduce((sum, entry) => sum + entry.length, 0);
    },

    /**
     * Calculates the total length by summing the drawn length and all manual additions.
     */
    calculateTotalLength(measurement: LinearMeasurement, scaleInfo: ScaleInfo | undefined): number {
        const drawnLength = this.calculateDrawnLength(measurement, scaleInfo);
        const manualLength = this.calculateManualLength(measurement);
        return drawnLength + manualLength;
    },

    /**
     * Formats a length in meters into a readable string (e.g., "1.23 m" or "45.6 cm").
     */
    formatLength(lengthInMeters: number): string {
        if (lengthInMeters < 1 && lengthInMeters > 0) {
            return `${(lengthInMeters * 100).toFixed(1)} cm`;
        }
        return `${lengthInMeters.toFixed(2)} m`;
    }
};
