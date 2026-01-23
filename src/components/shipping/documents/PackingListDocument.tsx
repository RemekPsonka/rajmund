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
    borderBottom: 2,
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
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
    backgroundColor: "#e0e0e0",
    padding: 6,
  },
  table: {
    marginTop: 5,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#2c3e50",
    color: "#fff",
    padding: 8,
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: 1,
    borderColor: "#ddd",
    padding: 6,
  },
  tableRowAlt: {
    backgroundColor: "#f5f5f5",
  },
  colLp: { width: "8%" },
  colSscc: { width: "22%" },
  colItems: { width: "15%" },
  colNetWeight: { width: "18%" },
  colGrossWeight: { width: "18%" },
  colNote: { width: "19%" },
  summary: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#2c3e50",
    color: "#fff",
    flexDirection: "row",
    justifyContent: "space-around",
  },
  summaryItem: {
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "bold",
  },
  summaryLabel: {
    fontSize: 9,
    marginTop: 3,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 30,
    right: 30,
    borderTop: 1,
    paddingTop: 10,
    fontSize: 8,
    color: "#666",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatures: {
    marginTop: 40,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureBox: {
    width: "40%",
    borderTop: 1,
    paddingTop: 5,
    alignItems: "center",
  },
});

interface PackingListProps {
  shipment: {
    shipment_number: string;
    dispatch_date: string;
    driver_name: string | null;
    truck_plates: string | null;
  };
  company: {
    name: string;
  };
  customer: {
    name: string;
  } | null;
  items: Array<{
    id: string;
    handling_unit?: {
      sscc_number: string;
      total_net_weight: number;
      total_gross_weight: number;
      items_count: number;
    };
    batch?: { internal_batch_number: string };
    product?: { name: string };
    quantity: number | null;
  }>;
  totalNetWeight: number;
  totalGrossWeight: number;
  palletsCount: number;
}

export function PackingListDocument({
  shipment,
  company,
  customer,
  items,
  totalNetWeight,
  totalGrossWeight,
  palletsCount,
}: PackingListProps) {
  const formatDate = (date: string) => {
    return format(new Date(date), "dd.MM.yyyy", { locale: pl });
  };

  // Group items by pallet
  const palletItems = items.filter((i) => i.handling_unit);
  const looseItems = items.filter((i) => !i.handling_unit && i.batch);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>PACKING LIST</Text>
            <Text style={styles.subtitle}>Lista Pakowa / Specyfikacja Załadunku</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 14, fontWeight: "bold" }}>
              {shipment.shipment_number}
            </Text>
            <Text>Data wysyłki: {formatDate(shipment.dispatch_date)}</Text>
          </View>
        </View>

        {/* Sender & Recipient */}
        <View style={{ flexDirection: "row", marginBottom: 20 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "bold", marginBottom: 3 }}>Od / From:</Text>
            <Text>{company.name}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "bold", marginBottom: 3 }}>Do / To:</Text>
            <Text>{customer?.name || "-"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "bold", marginBottom: 3 }}>Transport:</Text>
            <Text>{shipment.driver_name || "-"}</Text>
            <Text>{shipment.truck_plates || "-"}</Text>
          </View>
        </View>

        {/* Pallets Table */}
        {palletItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PALETY / Pallets</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.colLp}>Lp.</Text>
                <Text style={styles.colSscc}>Nr Palety (SSCC)</Text>
                <Text style={styles.colItems}>Szt. na palecie</Text>
                <Text style={styles.colNetWeight}>Waga Netto (kg)</Text>
                <Text style={styles.colGrossWeight}>Waga Brutto (kg)</Text>
                <Text style={styles.colNote}>Uwagi</Text>
              </View>
              {palletItems.map((item, idx) => (
                <View
                  key={item.id}
                  style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}
                >
                  <Text style={styles.colLp}>{idx + 1}</Text>
                  <Text style={styles.colSscc}>
                    {item.handling_unit?.sscc_number || "-"}
                  </Text>
                  <Text style={styles.colItems}>
                    {item.handling_unit?.items_count || 0}
                  </Text>
                  <Text style={styles.colNetWeight}>
                    {item.handling_unit?.total_net_weight.toFixed(2) || "0.00"}
                  </Text>
                  <Text style={styles.colGrossWeight}>
                    {item.handling_unit?.total_gross_weight.toFixed(2) || "0.00"}
                  </Text>
                  <Text style={styles.colNote}>-</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Loose Items Table */}
        {looseItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TOWAR LUZEM / Loose Items</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.colLp}>Lp.</Text>
                <Text style={styles.colSscc}>Nr Partii</Text>
                <Text style={{ width: "30%" }}>Produkt</Text>
                <Text style={styles.colNetWeight}>Ilość (kg)</Text>
                <Text style={styles.colNote}>Uwagi</Text>
              </View>
              {looseItems.map((item, idx) => (
                <View
                  key={item.id}
                  style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}
                >
                  <Text style={styles.colLp}>{idx + 1}</Text>
                  <Text style={styles.colSscc}>
                    {item.batch?.internal_batch_number || "-"}
                  </Text>
                  <Text style={{ width: "30%" }}>{item.product?.name || "-"}</Text>
                  <Text style={styles.colNetWeight}>
                    {item.quantity?.toFixed(2) || "0.00"}
                  </Text>
                  <Text style={styles.colNote}>-</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Summary */}
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{palletsCount}</Text>
            <Text style={styles.summaryLabel}>ŁĄCZNIE PALET</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {palletItems.reduce((s, i) => s + (i.handling_unit?.items_count || 0), 0) + looseItems.length}
            </Text>
            <Text style={styles.summaryLabel}>ŁĄCZNIE POZYCJI</Text>
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

        {/* Signatures */}
        <View style={styles.signatures}>
          <View style={styles.signatureBox}>
            <Text>Wydał / Issued by</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text>Odebrał / Received by</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Wygenerowano: {format(new Date(), "dd.MM.yyyy HH:mm")}</Text>
          <Text>Packing List - {shipment.shipment_number}</Text>
        </View>
      </Page>
    </Document>
  );
}
