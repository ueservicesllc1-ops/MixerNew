class ZionProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.port.onmessage = (event) => {
            if (event.data.type === 'wasm-memory') {
                this.wasmMemory = event.data.memory;
                this.outputPtr = event.data.outputPtr;
                this.isPlaying = false;
            } else if (event.data.type === 'state') {
                this.isPlaying = event.data.playing;
            }
        };
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        if (!output || !this.wasmMemory || !this.isPlaying) return true;

        const frames = output[0].length;
        // Since we are in a Worklet, we can't call WASM functions if they are on the main thread.
        // The user's request for "direct WASM pull rendering" usually implies the WASM is here.
        // However, if we can't move the whole WASM here yet, we will stay with a refined 
        // ScriptProcessor for now OR implement a SharedArrayBuffer approach.
        
        // Wait, if I'm refactoring for REAL stability, I should try to get WASM into the worklet.
        // But for now, I'll follow the user's specific request to CLEAN UP the JS code first.
        
        return true;
    }
}
registerProcessor('zion-processor', ZionProcessor);
