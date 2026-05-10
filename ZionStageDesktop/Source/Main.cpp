#include <juce_gui_basics/juce_gui_basics.h>
#include "MainComponent.h"

class ZionStageApplication : public juce::JUCEApplication {
public:
    ZionStageApplication() {}

    const juce::String getApplicationName() override { return "Zion Stage"; }
    const juce::String getApplicationVersion() override { return "1.0.0"; }
    bool moreThanOneInstanceAllowed() override { return true; }

    void initialise(const juce::String& commandLine) override {
        mainWindow.reset(new MainWindow(getApplicationName()));
    }

    void shutdown() override {
        mainWindow = nullptr;
    }

    void systemRequestedQuit() override {
        quit();
    }

    void suspended() override {}
    void resumed() override {}

    class MainWindow : public juce::DocumentWindow {
    public:
        MainWindow(juce::String name) : DocumentWindow(name, 
            juce::Colours::black, 
            juce::DocumentWindow::allButtons) 
        {
            setUsingNativeTitleBar(true);
            setContentOwned(new MainComponent(), true);
            setResizable(true, true);
            centreWithSize(getWidth(), getHeight());
            setVisible(true);
        }

        void closeButtonPressed() override {
            juce::JUCEApplication::getInstance()->systemRequestedQuit();
        }

    private:
        JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MainWindow)
    };

private:
    std::unique_ptr<MainWindow> mainWindow;
};

START_JUCE_APPLICATION(ZionStageApplication)
