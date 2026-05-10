#include <iostream>
#include <string>
#include "Core/ZionCore.h"

int main(int argc, char* argv[]) {
    std::cout << "--- Zion Audio Core CLI ---" << std::endl;

    // Get the central manager
    auto& zion = Zion::ZionCore::getInstance();

    // Initialize the engine
    std::cout << "Initializing Engine..." << std::endl;
    zion.initialize();

    if (argc > 1) {
        std::string filePath = argv[1];
        std::cout << "Loading file: " << filePath << std::endl;
        
        auto source = zion.getSourceManager().loadFile(filePath);
        
        if (source) {
            std::cout << "File loaded. Duration: " << source->getTotalLength() / 44100.0 << "s" << std::endl;
            
            // Set the source to transport (we use .get() because Transport expects a raw pointer 
            // for simple demos, but in production we'd manage lifetime better)
            zion.getTransport().setSource(source.get());
            
            std::cout << "Starting playback..." << std::endl;
            zion.getTransport().play();

            // Simple wait loop for the demo
            std::cout << "Press Enter to stop and exit..." << std::endl;
            std::cin.get();

            zion.getTransport().stop();
        } else {
            std::cerr << "Failed to load file." << std::endl;
        }
    } else {
        std::cout << "No file provided. Usage: ZionAudioConsole <path_to_audio_file>" << std::endl;
    }

    std::cout << "Shutting down..." << std::endl;
    zion.shutdown();

    return 0;
}
