use fbyt_clone_vault::math::share_math::{calculate_shares_to_mint, calculate_amount_out as amount_out};
use fbyt_clone_vault::math::fee_math::{calculate_performance_fee, calculate_management_fee};
use fbyt_clone_vault::pyth_price::calculate_amount_out as pyth_amount_out;

#[test]
fn rsma() {
    let data = include_str!("vectors/share_math_vectors.json");
    let cases: Vec<serde_json::Value> = serde_json::from_str(data).unwrap();
    let (mut pass, mut fail) = (0usize, 0usize);
    for case in &cases {
        let func = case["function"].as_str().unwrap();
        let inputs = &case["inputs"];
        let expect_ok = case["expect_ok"].as_bool().unwrap();
        let p = |k: &str| -> u64 { inputs[k].as_str().unwrap().parse().unwrap() };
        let result = match func {
            "calculate_shares_to_mint" => calculate_shares_to_mint(p("deposit_amount"), p("total_assets"), p("total_shares")),
            "calculate_amount_out" => amount_out(p("shares_to_burn"), p("total_assets"), p("total_shares")),
            f => panic!("Unknown: {}", f),
        };
        let ok = if expect_ok {
            match result { Ok(v) => v.to_string() == case["expected_output"].as_str().unwrap(), Err(_) => false }
        } else { result.is_err() };
        if ok { pass += 1 } else { fail += 1; eprintln!("FAIL #{}: {}", case["id"], case["description"]); }
    }
    assert_eq!(fail, 0, "{}/{} share failed", fail, pass+fail);
    println!("share_math: {}/{}", pass, pass+fail);
}

#[test]
fn rfma() {
    let data = include_str!("vectors/fee_math_vectors.json");
    let cases: Vec<serde_json::Value> = serde_json::from_str(data).unwrap();
    let (mut pass, mut fail) = (0usize, 0usize);
    for case in &cases {
        let func = case["function"].as_str().unwrap();
        let inputs = &case["inputs"];
        let expect_ok = case["expect_ok"].as_bool().unwrap();
        let pu = |k: &str| -> u64 { inputs[k].as_str().unwrap().parse().unwrap() };
        let result = match func {
            "calculate_performance_fee" =>
                calculate_performance_fee(pu("profit"), inputs["performance_fee_bps"].as_str().unwrap().parse().unwrap()),
            "calculate_management_fee" =>
                calculate_management_fee(pu("total_assets"),
                    inputs["management_fee_bps"].as_str().unwrap().parse().unwrap(),
                    inputs["elapsed_seconds"].as_str().unwrap().parse::<i64>().unwrap()),
            f => panic!("Unknown: {}", f),
        };
        let ok = if expect_ok {
            match result { Ok(v) => v.to_string() == case["expected_output"].as_str().unwrap(), Err(_) => false }
        } else { result.is_err() };
        if ok { pass += 1 } else { fail += 1; eprintln!("FAIL #{}: {}", case["id"], case["description"]); }
    }
    assert_eq!(fail, 0, "{}/{} fee failed", fail, pass+fail);
    println!("fee_math: {}/{}", pass, pass+fail);
}

#[test]
fn rpyth() {
    let cases: Vec<serde_json::Value> = serde_json::from_str(include_str!("vectors/pyth_price_vectors.json")).unwrap();
    let (mut pass, mut fail) = (0usize, 0usize);
    for case in &cases {
        let inputs = &case["inputs"];
        let expect_ok = case["expect_ok"].as_bool().unwrap();
        let amount_in: u64 = inputs["amount_in"].as_str().unwrap().parse().unwrap();
        let price: i64 = inputs["price"].as_str().unwrap().parse().unwrap();
        let expo: i32 = inputs["expo"].as_i64().unwrap() as i32;
        let input_decimals: u8 = inputs["input_decimals"].as_u64().unwrap() as u8;
        let output_decimals: u8 = inputs["output_decimals"].as_u64().unwrap() as u8;
        let is_quote_to_base = inputs.get("is_quote_to_base").and_then(|v| v.as_bool()).unwrap_or(false);
        let result = pyth_amount_out(amount_in, price, expo, input_decimals, output_decimals, is_quote_to_base);
        let ok = if expect_ok {
            match result { Ok(v) => v.to_string() == case["expected_output"].as_str().unwrap(), Err(_) => false }
        } else { result.is_err() };
        if ok { pass += 1 } else { fail += 1; eprintln!("FAIL #{}: {}", case["id"], case["description"]); }
    }
    assert_eq!(fail, 0, "{}/{} pyth failed", fail, pass+fail);
    println!("pyth_price: {}/{}", pass, pass+fail);
}