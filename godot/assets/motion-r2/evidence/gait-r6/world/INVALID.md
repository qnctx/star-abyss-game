# Superseded fixture capture

This first world capture is INVALID for jog/sprint verification. NativeMain asynchronously re-enabled NativePlayer physics after the fixture disabled it; duplicated updates kept actual speed near 0.4667 m/s. The fixture was corrected after startup settling and re-run in ../world-final/. Production NativePlayer/NativeMain were unchanged.
