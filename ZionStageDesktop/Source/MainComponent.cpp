#include "MainComponent.h"

MainComponent::MainComponent()
    : webView(std::make_unique<juce::WebBrowserComponent>(ZionDesktopBridge::buildWebOptions(desktopBridge)))
{
    desktopBridge.ensureAudio();
    addAndMakeVisible(*webView);

    // Dev: interfaz en Vite http://localhost:3000; API en b2-proxy :3001 (`npm run dev` + `npm run start-proxy`).
    webView->goToURL("http://localhost:3000");
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
