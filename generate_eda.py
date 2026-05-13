import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as plt_sns
import seaborn as sns

def main():
    # File paths
    file_path = 'data/processed/undersampled_with_demo_clipped.csv'
    output_dir = 'eda_outputs'
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"Loading data from {file_path}...")
    # Load dataset. We keep operations lightweight.
    # We will load the dataset; if it's huge, we might take a sample for plotting.
    # The file size is ~906MB. Loading it entirely takes some RAM but should be fine.
    df = pd.read_csv(file_path)
    
    # 2. Show shape, columns, and first 5 rows
    print("-" * 50)
    print("Dataset Shape:", df.shape)
    print("Columns in Dataset:", df.columns.tolist())
    print("-" * 50)
    print("First 5 Rows:")
    print(df.head())
    print("-" * 50)
    
    # 3. Identify numerical features
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    print("Numerical Features Identified:")
    print(num_cols)
    print("-" * 50)
    
    # 4. Generate basic EDA
    # Style configuration for publication-quality plots
    sns.set_theme(style="whitegrid", context="paper", font_scale=1.2)
    
    # Target columns to plot distributions for
    target_cols = ['mean_hr', 'mean_spo2', 'birth_weight']
    available_targets = [c for c in target_cols if c in df.columns]
    
    if not available_targets:
        print("Expected columns not found. Printing first 3 numerical features instead.")
        available_targets = num_cols[:3]
        
    print(f"Generating distribution plots for: {available_targets}")
    
    # To keep operations lightweight, we can sample the dataframe for plotting if it's very large
    plot_df = df.sample(n=min(100000, len(df)), random_state=42) if len(df) > 100000 else df
    
    for col in available_targets:
        if col in plot_df.columns:
            plt.figure(figsize=(8, 5))
            # Dropna just for the plot to avoid warnings
            sns.histplot(plot_df[col].dropna(), kde=True, bins=50, color='royalblue')
            plt.title(f'Distribution of {col}', fontsize=14, fontweight='bold')
            plt.xlabel(col, fontsize=12)
            plt.ylabel('Frequency', fontsize=12)
            plt.tight_layout()
            
            output_path = os.path.join(output_dir, f'distribution_{col}.png')
            plt.savefig(output_path, dpi=300)
            plt.close()
            print(f"Saved distribution plot: {output_path}")

    # Generate Correlation Heatmap
    print("-" * 50)
    print("Generating Correlation Heatmap...")
    # Limit number of numerical columns for clarity if there are too many
    if len(num_cols) > 20:
        print("More than 20 numerical features found. Selecting top 20 for heatmap readability.")
        heatmap_cols = num_cols[:20]
    else:
        heatmap_cols = num_cols
        
    # Calculate correlation matrix on the sampled dataframe to be lightweight
    corr_matrix = plot_df[heatmap_cols].corr()
    
    plt.figure(figsize=(10, 8))
    # Use a nice diverging colormap
    cmap = sns.diverging_palette(230, 20, as_cmap=True)
    
    sns.heatmap(corr_matrix, cmap=cmap, vmax=1.0, vmin=-1.0, center=0,
                square=True, linewidths=.5, cbar_kws={"shrink": .7}, annot=False)
    
    plt.title('Correlation Heatmap of Numerical Features', fontsize=14, fontweight='bold')
    plt.tight_layout()
    
    output_path = os.path.join(output_dir, 'correlation_heatmap.png')
    plt.savefig(output_path, dpi=300)
    plt.close()
    print(f"Saved correlation heatmap: {output_path}")
    print("-" * 50)
    print("EDA Visualizations generation complete.")

if __name__ == "__main__":
    main()
