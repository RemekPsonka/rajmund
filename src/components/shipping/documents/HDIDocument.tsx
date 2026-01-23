import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

// Register font (using default for now)
Font.register({
  family: "Roboto",
  src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf",
});

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 9,
    fontFamily: "Roboto",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    borderBottom: 1,
    paddingBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 10,
    color: "#666",
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 8,
    backgroundColor: "#f0f0f0",
    padding: 5,
  },
  row: {
    flexDirection: "row",
    marginBottom: 3,
  },
  label: {
    width: 120,
    fontWeight: "bold",
  },
  value: {
    flex: 1,
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#333",
    color: "#fff",
    padding: 5,
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: 1,
    borderColor: "#ddd",
    padding: 4,
  },
  tableRowAlt: {
    backgroundColor: "#f9f9f9",
  },
  col1: { width: "5%" },
  col2: { width: "20%" },
  col3: { width: "25%" },
  col4: { width: "15%" },
  col5: { width: "15%" },
  col6: { width: "10%" },
  col7: { width: "10%" },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 30,
    right: 30,
    borderTop: 1,
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#666",
  },
  summary: {
    marginTop: 15,
    padding: 10,
    backgroundColor: "#f0f0f0",
    flexDirection: "row",
    justifyContent: "space-around",
  },
  summaryItem: {
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "bold",
  },
  summaryLabel: {
    fontSize: 8,
    color: "#666",
  },
  vetBox: {
    border: 2,
    borderColor: "#000",
    padding: 10,
    marginBottom: 15,
  },
  vetTitle: {
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 5,
  },
  vetNumber: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
  },
});

interface HDIDocumentProps {
  shipment: {
    shipment_number: string;
    dispatch_date: string;
    transport_temperature: number | null;
    driver_name: string | null;
    truck_plates: string | null;
    trailer_plates: string | null;
    seal_number: string | null;
  };
  company: {
    name: string;
    tax_id: string;
  };
  facility: {
    name: string;
    vet_approval_number: string | null;
  };
  customer: {
    name: string;
    vet_number: string | null;
  } | null;
  carrier: {
    name: string;
  } | null;
  traceability: Array<{
    id: string;
    product?: { name: string };
    source_batch?: {
      internal_batch_number: string;
      production_date: string | null;
      expiration_date: string | null;
    };
    weight_net: number;
    handling_unit?: { sscc_number: string };
  }>;
  totalNetWeight: number;
  totalGrossWeight: number;
  palletsCount: number;
}

export function HDIDocument({
  shipment,
  company,
  facility,
  customer,
  carrier,
  traceability,
  totalNetWeight,
  totalGrossWeight,
  palletsCount,
}: HDIDocumentProps) {
  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return format(new Date(date), "dd.MM.yyyy", { locale: pl });
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>HANDLOWY DOKUMENT IDENTYFIKACYJNY</Text>
            <Text style={styles.subtitle}>HDI / Commercial Document</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 12, fontWeight: "bold" }}>
              {shipment.shipment_number}
            </Text>
            <Text>Data: {formatDate(shipment.dispatch_date)}</Text>
          </View>
        </View>

        {/* Veterinary Approval Box */}
        <View style={styles.vetBox}>
          <Text style={styles.vetTitle}>ZAKŁAD ZATWIERDZONY WETERYNARYJNIE</Text>
          <Text style={styles.vetNumber}>
            {facility.vet_approval_number || "BRAK NUMERU WET."}
          </Text>
          <Text style={{ textAlign: "center", marginTop: 5 }}>
            {company.name}
          </Text>
          <Text style={{ textAlign: "center", fontSize: 8 }}>
            {facility.name}
          </Text>
        </View>

        {/* Sender & Recipient */}
        <View style={{ flexDirection: "row", marginBottom: 15 }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.sectionTitle}>NADAWCA / Sender</Text>
            <Text style={{ fontWeight: "bold" }}>{company.name}</Text>
            <Text>NIP: {company.tax_id}</Text>
            <Text>Nr wet.: {facility.vet_approval_number || "-"}</Text>
          </View>
          <View style={{ flex: 1, paddingLeft: 10 }}>
            <Text style={styles.sectionTitle}>ODBIORCA / Recipient</Text>
            <Text style={{ fontWeight: "bold" }}>{customer?.name || "-"}</Text>
            <Text>Nr wet.: {customer?.vet_number || "-"}</Text>
          </View>
        </View>

        {/* Transport Data */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DANE TRANSPORTU / Transport Details</Text>
          <View style={{ flexDirection: "row" }}>
            <View style={{ flex: 1 }}>
              <View style={styles.row}>
                <Text style={styles.label}>Przewoźnik:</Text>
                <Text style={styles.value}>{carrier?.name || "Własny"}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Kierowca:</Text>
                <Text style={styles.value}>{shipment.driver_name || "-"}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Nr plomby:</Text>
                <Text style={styles.value}>{shipment.seal_number || "-"}</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.row}>
                <Text style={styles.label}>Nr rej. ciągnika:</Text>
                <Text style={styles.value}>{shipment.truck_plates || "-"}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Nr rej. naczepy:</Text>
                <Text style={styles.value}>{shipment.trailer_plates || "-"}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Temp. transportu:</Text>
                <Text style={styles.value}>
                  {shipment.transport_temperature !== null
                    ? `${shipment.transport_temperature}°C`
                    : "-"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Traceability Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            WYKAZ TOWARÓW / ŚLADOWOŚĆ (Traceability)
          </Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.col1}>Lp.</Text>
              <Text style={styles.col2}>Produkt</Text>
              <Text style={styles.col3}>Nr Partii</Text>
              <Text style={styles.col4}>Data Uboju</Text>
              <Text style={styles.col5}>Data Ważności</Text>
              <Text style={styles.col6}>Waga (kg)</Text>
              <Text style={styles.col7}>Paleta</Text>
            </View>
            {traceability.map((item, idx) => (
              <View
                key={item.id}
                style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}
              >
                <Text style={styles.col1}>{idx + 1}</Text>
                <Text style={styles.col2}>{item.product?.name || "-"}</Text>
                <Text style={styles.col3}>
                  {item.source_batch?.internal_batch_number || "-"}
                </Text>
                <Text style={styles.col4}>
                  {formatDate(item.source_batch?.production_date || null)}
                </Text>
                <Text style={styles.col5}>
                  {formatDate(item.source_batch?.expiration_date || null)}
                </Text>
                <Text style={styles.col6}>{item.weight_net.toFixed(2)}</Text>
                <Text style={styles.col7}>
                  {item.handling_unit?.sscc_number?.slice(-6) || "-"}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Summary */}
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{palletsCount}</Text>
            <Text style={styles.summaryLabel}>PALET</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totalNetWeight.toFixed(1)} kg</Text>
            <Text style={styles.summaryLabel}>WAGA NETTO</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totalGrossWeight.toFixed(1)} kg</Text>
            <Text style={styles.summaryLabel}>WAGA BRUTTO</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Wygenerowano: {format(new Date(), "dd.MM.yyyy HH:mm")}</Text>
          <Text>System MES - {company.name}</Text>
        </View>
      </Page>
    </Document>
  );
}
