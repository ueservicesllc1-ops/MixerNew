#include "MainComponent.h"

MainComponent::MainComponent()
    : webView(std::make_unique<juce::WebBrowserComponent>(ZionDesktopBridge::buildWebOptions(desktopBridge)))
{
    desktopBridge.ensureAudio();
    addAndMakeVisible(*webView);

    // Shell escritorio: misma URL que el stack local completo (b2-proxy + dist en :3001).
    // No es la app "solo Vite" (:3000). Antes de abrir Zion Stage: `npm start` o `npm run build && npm run start-proxy`.
    webView->goToURL("http://localhost:3001");
    setSize(1280, 800);
}

MainComponent::~MainComponent() {}

void MainComponent::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colours::black);
}

void MainComponent::resized()
{
    if (webView != nullptr) webView->setBounds(getLocalBounds());
}
