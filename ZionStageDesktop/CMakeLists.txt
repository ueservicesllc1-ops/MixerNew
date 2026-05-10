cmake_minimum_required(VERSION 3.15)

project(ZionStage VERSION 1.0.0 LANGUAGES CXX)

# --- Configuración de JUCE (Usando copia local para velocidad) ---
set(JUCE_PATH "E:/Mixer/ZionAudioCore/build/_deps/juce-src" CACHE PATH "Path to JUCE")
add_subdirectory(${JUCE_PATH} ./JUCE)

# --- Definición de la Aplicación ---
juce_add_gui_app(ZionStage
    PRODUCT_NAME "Zion Stage"
    COMPANY_NAME "Zion Audio"
    BUNDLE_ID "com.zion.stage"
    IS_CONTENT_BROWSER_APP TRUE
    NEEDS_CURL TRUE
    # Asegurar que se genere el JuceHeader.h para compatibilidad
)

# --- Archivos de Origen ---
target_sources(ZionStage PRIVATE
    Source/Main.cpp
    Source/MainComponent.h
    Source/MainComponent.cpp
    
    # Managers
    Source/Managers/LicenseManager.h
    Source/Managers/LicenseManager.cpp
    Source/Managers/EncryptedCacheManager.h
    Source/Managers/EncryptedCacheManager.cpp
    Source/Managers/DownloadManager.h
    Source/Managers/DownloadManager.cpp
    Source/Managers/SetlistManager.h
    Source/Managers/MetadataDB.h
    
    # Audio
    Source/Audio/ZionAudioEngine.h
    Source/Audio/MidiManager.h
    Source/Audio/DesktopMixSession.cpp
    Source/Audio/ZionDesktopBridge.cpp
    
    # UI Components
    Source/UI/ZionMixerComponent.h
    Source/UI/SongLibraryComponent.h
    
    # Referencia al Core compartido de ZionAudioCore
    ../ZionAudioCore/Core/ZionCore.cpp
    ../ZionAudioCore/Engine/AudioEngine.cpp
    ../ZionAudioCore/Transport/Transport.cpp
    ../ZionAudioCore/Source/AudioSourceManager.cpp
)

# --- Inclusión de Cabeceras ---
target_include_directories(ZionStage PRIVATE
    Source
    Source/Audio
    Source/Managers
    Source/UI
    ../ZionAudioCore # Añadir la base para que Engine/ sea accesible
)

# --- Generar JuceHeader.h (Opcional pero recomendado para compatibilidad) ---
# En versiones modernas de JUCE CMake, esto se hace así:
# (Nota: si ya existe por el build anterior, CMake lo encontrará)

# --- Módulos de JUCE Necesarios ---
target_link_libraries(ZionStage PRIVATE
    juce::juce_audio_basics
    juce::juce_audio_devices
    juce::juce_audio_formats
    juce::juce_audio_processors
    juce::juce_audio_utils
    juce::juce_core
    juce::juce_data_structures
    juce::juce_events
    juce::juce_graphics
    juce::juce_gui_basics
    juce::juce_gui_extra
    juce::juce_cryptography
)

# --- Definiciones de Preprocesador ---
target_compile_definitions(ZionStage PRIVATE
    JUCE_WEB_BROWSER=1
    JUCE_USE_WIN_WEBVIEW2=1 # <--- ESTO ACTIVA EL MOTOR MODERNO (EDGE)
    JUCE_USE_CURL=1
    ZION_DESKTOP=1
)

if(MSVC)
    target_compile_options(ZionStage PRIVATE /FS)
endif()
