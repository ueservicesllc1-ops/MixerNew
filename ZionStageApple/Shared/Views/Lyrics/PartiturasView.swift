//
//  PartiturasView.swift
//  ZionStageApple
//
//  Visor de partituras PDF por instrumento.
//  Usa PDFKit nativo de iOS/macOS.
//

import SwiftUI
import PDFKit

public struct PartiturasView: View {
    public let partituras: [Partitura]
    @State private var selectedPartitura: Partitura?
    @State private var isFullscreen: Bool = false

    public init(partituras: [Partitura]) {
        self.partituras = partituras
    }

    public var body: some View {
        VStack(spacing: 0) {
            if partituras.isEmpty {
                emptyView
            } else {
                // Selector de instrumento
                if partituras.count > 1 {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 10) {
                            ForEach(partituras) { p in
                                Button(action: { selectedPartitura = p }) {
                                    Text(p.instrument.isEmpty ? "Partitura" : p.instrument)
                                        .font(.system(size: 13, weight: .medium))
                                        .foregroundColor(selectedPartitura?.id == p.id ? .black : .cyan)
                                        .padding(.horizontal, 14)
                                        .padding(.vertical, 8)
                                        .background(
                                            RoundedRectangle(cornerRadius: 8)
                                                .fill(selectedPartitura?.id == p.id ? Color.cyan : Color.cyan.opacity(0.1))
                                        )
                                }
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                    }
                    .background(Color(red: 0.08, green: 0.09, blue: 0.14))

                    Divider().background(Color.cyan.opacity(0.2))
                }

                // Visor PDF
                if let p = selectedPartitura ?? partituras.first {
                    ZStack(alignment: .topTrailing) {
                        PDFViewRepresentable(urlString: p.pdfUrl)

                        // Botón pantalla completa
                        Button(action: { isFullscreen = true }) {
                            Image(systemName: "arrow.up.left.and.arrow.down.right")
                                .font(.system(size: 16))
                                .foregroundColor(.white)
                                .padding(10)
                                .background(Circle().fill(Color.black.opacity(0.6)))
                        }
                        .padding(16)
                    }
                }
            }
        }
        .background(Color(red: 0.06, green: 0.07, blue: 0.1))
        .sheet(isPresented: $isFullscreen) {
            if let p = selectedPartitura ?? partituras.first {
                ZStack(alignment: .topTrailing) {
                    PDFViewRepresentable(urlString: p.pdfUrl)
                        .ignoresSafeArea()

                    Button(action: { isFullscreen = false }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 28))
                            .foregroundColor(.white)
                            .padding()
                    }
                }
                .background(Color.black)
            }
        }
        .onAppear {
            if selectedPartitura == nil {
                selectedPartitura = partituras.first
            }
        }
    }

    private var emptyView: some View {
        VStack(spacing: 16) {
            Image(systemName: "doc.richtext")
                .font(.system(size: 48))
                .foregroundColor(.gray.opacity(0.3))
            Text("No hay partituras disponibles")
                .font(.subheadline)
                .foregroundColor(.gray)
            Text("Las partituras se agregan desde zionstage.com")
                .font(.caption)
                .foregroundColor(.gray.opacity(0.6))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(red: 0.06, green: 0.07, blue: 0.1))
    }
}

// MARK: - PDFKit Wrapper
struct PDFViewRepresentable: UIViewRepresentable {
    let urlString: String

    func makeUIView(context: Context) -> PDFView {
        let pdfView = PDFView()
        pdfView.autoScales = true
        pdfView.displayMode = .singlePageContinuous
        pdfView.displayDirection = .vertical
        pdfView.backgroundColor = UIColor(red: 0.06, green: 0.07, blue: 0.1, alpha: 1)

        if let url = URL(string: urlString) {
            // Cargar desde URL remota en background
            DispatchQueue.global(qos: .userInitiated).async {
                if let data = try? Data(contentsOf: url),
                   let doc = PDFDocument(data: data) {
                    DispatchQueue.main.async {
                        pdfView.document = doc
                    }
                }
            }
        }
        return pdfView
    }

    func updateUIView(_ uiView: PDFView, context: Context) {}
}
